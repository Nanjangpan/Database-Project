/* eslint-disable react/jsx-filename-extension */
import React, { useEffect, useRef } from 'react';
import Button from '@material-ui/core/Button';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogTitle from '@material-ui/core/DialogTitle';
import { useDispatch, useSelector } from 'react-redux';
import AppendOGDataType, { submitOGDataType } from './AppendOGDataType';
import { setOriginalData, clearOriginalData } from '../../actions/originalData';
import {
  openAlert,
  openDialog,
  setAlertType,
  setMessage,
} from '../../actions/message';
import { getAdmin } from '../../services/user.service';

export default function AppendOGDataTypeDialog({
  open,
  handleClose,
  taskName,
}) {
  const dispatch = useDispatch();
  const childRef = useRef();
  const { data, name, columns } = useSelector((state) => state.originalData);

  useEffect(() => {
    dispatch(clearOriginalData());
    if (open) {
      /* TODO: 완료! task에 대한 scheme 다운로드해서 setTaskData에 넣음. */
      getAdmin('/task/schema', { taskName }).then((response) => {
        const { data } = response.data;
        data.forEach((row) => {
          row.originalColumnName = '';
        });
        dispatch(setOriginalData(data));
      });
    }
  }, [open]);

  const isNullExist = () => data.some((entry) => !entry.originalColumnName);

  const handleSubmit = () => {
    if (!name) {
      dispatch(setAlertType('error'));
      dispatch(setMessage('스키마 이름을 입력해주세요'));
      dispatch(openAlert());
      return;
    }

    childRef.current.submitOGDataType(taskName).then(
      () => {
        dispatch(setAlertType('success'));
        dispatch(setMessage('데이터가 성공적으로 추가되었습니다'));
        dispatch(openAlert());
        handleClose();
      },
      (error) => {
        const message =
          (error.response &&
            error.response.data &&
            error.response.data.message) ||
          error.message ||
          error.toString();
        dispatch(setAlertType('error'));
        dispatch(setMessage(message));
        dispatch(openAlert());
      }
    );

    // TODO: 완료! 원본 데이터 스키마 제출하기
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      aria-labelledby="form-dialog-title"
    >
      <DialogTitle id="form-dialog-title">
        {taskName}에 원본 데이터 스키마 추가
      </DialogTitle>
      <DialogContent>
        <AppendOGDataType ref={childRef} />
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} color="primary">
          취소
        </Button>
        <Button onClick={handleSubmit} color="primary" variant="contained">
          확인
        </Button>
      </DialogActions>
    </Dialog>
  );
}
