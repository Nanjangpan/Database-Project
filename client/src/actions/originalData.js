import {
  SET_ORIGINAL_DATA,
  SET_SCHEMA_NAME,
  CLEAR_ORIGINAL_DATA,
  SET_COLUMNS,
} from './ActionTypes';

export const setOriginalData = (data) => ({
  type: SET_ORIGINAL_DATA,
  payload: data,
});

export const setSchemaName = (name) => ({
  type: SET_SCHEMA_NAME,
  payload: name,
});

export const clearOriginalData = () => ({
  type: CLEAR_ORIGINAL_DATA,
});

export const setColumns = (data) => ({
  type: SET_COLUMNS,
  payload: data,
});
