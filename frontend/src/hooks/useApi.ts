import { useState, useCallback } from 'react';
import type { AxiosError } from 'axios';
import type { ApiErrorResponse } from '../types';

interface ApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export function useApi<T>() {
  const [state, setState] = useState<ApiState<T>>({
    data: null,
    loading: false,
    error: null,
  });

  const execute = useCallback(async (promise: Promise<{ data: T }>) => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const { data } = await promise;
      setState({ data, loading: false, error: null });
      return data;
    } catch (err) {
      const axiosErr = err as AxiosError<ApiErrorResponse>;
      const msg = axiosErr.response?.data?.message ?? axiosErr.message ?? 'Something went wrong';
      setState((s) => ({ ...s, loading: false, error: msg }));
      throw err;
    }
  }, []);

  const reset = useCallback(() => {
    setState({ data: null, loading: false, error: null });
  }, []);

  return { ...state, execute, reset };
}
