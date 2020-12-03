const db = require('../models');
const csv = require('csvtojson');
const json2csv = require('json2csv').parse;
const fs = require('fs');
const { nowDate, csvSanityCheck, typeCheck } = require("../utils/generalUtils");
const { user, parsing_data, evaluate, works_on, AVG_SCORE, og_data_type, task } = db;
const Sequelize = require('sequelize')
const sequelize = new Sequelize({
  dialect: 'mysql',
})

exports.submitContent = (req, res, next) => {
  console.log(`Submit user ${req.body.username} submitted data`)
  if (!req.file) {
    return res.status(405).json({
      message: '파일 업로드 형식이 잘 못 되었습니다. CSV 파일로 업로드 부탁드립니다'
    })
  }
  og_data_type.findOne({
    where: {
      TaskName: req.body.TaskName,
      Name: req.body.ogDataName
    }
  }).then((og_data_type) => {
    if (og_data_type) {
      task.findOne({
        where: {
          TaskName: req.body.TaskName
        }
      }).then((task) => {
        req.body.taskDataTableRef = task.TableRef
        req.body.Mapping = og_data_type.Mapping
        req.body.ogSchema = og_data_type.Schema
        next()
      })

    } else {
      return res.status(400).json({
        "message": "og_data_type이 존재하지 않습니다"
      })
    }
  })
};

exports.quantAssess = async function (req, res, next) {
  const data = await csv({ noheader: false }).fromFile(req.file.path)  // set this to be true for csvSanityCheck
  const taskCol = Object.values(
    (await csv({ noheader: true }).fromFile(req.body.taskDataTableRef))[0]
  )
  taskCol.pop() // pop "Sid" from task data columns

  const dataHeader = Object.keys(data[0]);
  const { Mapping, ogSchema } = req.body

  if (JSON.stringify(dataHeader.sort()) != JSON.stringify(Object.keys(ogSchema))) {
    // reject if ogSchema keys do not match submitted data columns (order does not matter)
    return res.status(404).json({
      "message": "submitted csv file does not match the schema defined in original data type"
    })
  }

  var dupCount = rowCount = nullCount = 0;
  var counts = {}
  var parsedData = []

  console.log(taskCol)
  data.forEach((row) => {
    rowCount++;
    var parsedRows = {}
    taskCol.forEach((col) => {
      if (!typeCheck(ogSchema[Mapping[col]], row[Mapping[col]])) {
        // reject if data contains wrong datatype
        return res.status(404).json({
          "message": "submitted csv file has wrong data type"
        })
      }
      if (row[Mapping[col]] == "null" || row[Mapping[col]] === undefined) {
        nullCount++;
      }
      parsedRows[col] = row[Mapping[col]]
    })
    counts[Object.values(row)] = (counts[Object.values(row)] || 0) + 1
    parsedData.push(parsedRows)
  })

  Object.values(counts).forEach((count) => {
    if (count > 1) {
      dupCount = dupCount + (count - 1)
    }
  })
  req.body.TotalTupleCnt = rowCount
  req.body.DuplicatedTupleCnt = dupCount
  req.body.NullRatio = (nullCount) / (rowCount * taskCol.length)
  console.log(parsedData)
  parsedData = json2csv(parsedData, { header: true })
  console.log(`parsed${req.file.path}`)
  await fs.writeFileSync(`parsed${req.file.path}`, parsedData);
  next();
}

exports.systemAssessment = function (req, res, next) {
  /* automatic system assessment */
  // ! Term --> submitted by user

  var submitSid, submitDid;

  /* find submitter Sid */
  user.findOne({
    where: {
      ID: req.body.username
    }
  }).then((user) => {
    if (user) {
      submitSid = user.Uid
      parsing_data.findAndCountAll({
        where: {
          Sid: user.Uid
        }
      }).then((p_data) => {
        if (p_data) {
          /* find submitted Did */
          og_data_type.findOne({
            where: {
              Name: req.body.ogDataName,
              TaskName: req.body.TaskName
            }
          }).then((og_data_type) => {
            if (og_data_type) {
              submitDid = og_data_type.Did
              parsing_data.create({
                "FinalScore": null,
                "TaskName": req.body.TaskName,
                "SubmitCnt": p_data.count + 1,
                "TotalTupleCnt": req.body.TotalTupleCnt,
                "DuplicatedTupleCnt": req.body.DuplicatedTupleCnt,
                "NullRatio": req.body.NullRatio,
                "Term": nowDate("DateTime"),    // supposed to be sent from the user
                "DataRef": `parsed${req.file.path}`,
                "TimeStamp": nowDate("DateTime"),
                "Did": submitDid,
                "Sid": submitSid
              }).then((parsing_data) => {
                if (parsing_data) {
                  next();
                } else {
                  return res.status(400).json({
                    "message": `parsing_data에 데이터를 삽입하는데 실패하였습니다`
                  })
                }
              })
            } else {
              return res.status(400).json({
                "message": "og_data_type이 존재하지 않습니다"
              })
            }
          })
        } else {
          return res.status(400).json({
            "message": "유저는 서브밋을 여러번 할 수 없습니다"
          })
        }
      })
    } else {
      return res.status(400).json({
        "message": "유저가 존재하지 않습니다""
      })
    }
  })
};

exports.assignEvaluator = function (req, res) {
  /* assigning evaluator */
  /* if there is no evaluator, can they still upload? */
  /* the logic below does not allow that */
  // ! Pid obtained by max (most recent)
  parsing_data.findOne({
    attributes: [[
      sequelize.fn('MAX', sequelize.col('Pid')), 'Pid'
    ]],
    raw: true,
  }).then((parsing_data) => {
    if (parsing_data) {
      user.findOne({
        where: {
          UType: 'eval',
        },
        order: sequelize.random(),
      }).then((user) => {
        if (user) {
          console.log("hello")
          evaluate.create({
            "Eid": user.Uid,
            "Pid": parsing_data.Pid
          }).then((evaluate) => {
            if (evaluate) {
              return res.status(200).json({
                "message": `Parsing data에 데이터를 성공적으로 추가하고 평가자를 할당했습니다`
              })
            }
          })
        } else {
          return res.status(206).json({
            "message": `Parsing data에 데이터를 성공적으로 추가였지만 평가자를 할당 받지 못했습니다`
          })
        }
      });
    } else {
      return res.status(404).json({
        "message": `데이터베이스에 Parsing data가 존재하지 않습니다`
      })
    }
  })
};

exports.getTaskList = function (req, res) {
  var taskList = []
  const { username, per_page, page } = req.query
  user.findOne({
    where: {
      ID: username
    }
  }).then((user) => {
    works_on.findAll({
      where: {
        Sid: user.Uid,
        Permit: 1
      },
      offset: (parseInt(per_page) * (parseInt(page) - 1)),
      limit: parseInt(per_page)
    }).then((works_on) => {
      if (works_on) {
        works_on.forEach((data) => {
          taskList.push(data.TaskName)
        })
        return res.status(200).json({
          "TaskNameList": taskList
        })
      } else {
        return res.status(400).json({
          message: "관리자가 task를 승인하지 않았습니다"
        })
      }
    })
  })
}

exports.submitApply = function (req, res) {
  const { username, TaskName } = req.body
  user.findOne({
    where: {
      ID: username
    }
  }).then((user) => {
    works_on.create({
      Sid: user.Uid,
      TaskName: TaskName
    }).then((works_on) => {
      if (works_on) {
        return res.status(200).json({
          message: "요청을 성공하였습니다"
        })
      } else {
        return res.status(500).json({
          message: "요청을 실패했습니다"
        })
      }
    })
  })
}

exports.getAvgScore = function (req, res) {
  /* get average score and total tuple cnt*/
  const { username } = req.query
  user.findOne({
    where: {
      ID: username
    }
  }).then((user) => {
    if (user) {
      parsing_data.count({
        where: {
          Sid: user.Uid
        },
      }).then((p_data) => {
        if (p_data) {
          AVG_SCORE.findByPk(
            user.Uid
          ).then((AVG_SCORE) => {
            if (AVG_SCORE) {
              parsing_data.findOne({
                attributes: [[
                  sequelize.fn('SUM', sequelize.col('TotalTupleCnt')), 'TotalTupleCnt'
                ]],
                where: {
                  Sid: user.Uid,
                  Appended: 1
                },
                raw: true,
              }).then((parsing_data) => {
                if (parsing_data) {
                  return res.status(200).json({
                    "Score": AVG_SCORE.Score,
                    "SubmittedDataCnt": p_data,
                    "TaskDataTableTupleCnt": parsing_data.TotalTupleCnt
                  })
                } else {
                  return res.status(400).json({
                    "message": "데이터를 찾을 수 없습니다"
                  })
                }
              })

            } else {
              return res.status(400).json({
                "message": "og_data_type이 존재하지 않습니다"
              })
            }
          })
        } else {
          return res.status(400).json({
            "message": "사용자가 parsing_data를 제출하지 않았습니다"
          })
        }
      })
    } else {
      return res.status(400).json({
        "message": "해당 사용자가 존재하지 않습니다"
      })
    }
  })
}

exports.getOgData = (req, res) => {
  const { taskName } = req.query
  og_data_type.findAll({
    attributes: ['Did', 'Name'],
    where: { TaskName: taskName }
  })
    .then((result) => {
      res.status(200).json({
        data: result
      })
    })
};
