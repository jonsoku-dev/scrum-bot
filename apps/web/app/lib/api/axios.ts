import axios, { type AxiosRequestConfig } from 'axios';

export const AXIOS_INSTANCE = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  headers: {
    'Content-Type': 'application/json',
  },
});

export const customInstance = <T>(
  config: AxiosRequestConfig,
  options?: AxiosRequestConfig,
): Promise<T> => {
  const source = axios.CancelToken.source();
  const promise = AXIOS_INSTANCE({
    ...config,
    ...options,
    cancelToken: source.token,
  }).then(({ data }) => data);

  const extendedPromise = promise as Promise<T> & { cancel: () => void };
  extendedPromise.cancel = () => {
    source.cancel('Query was cancelled');
  };

  return extendedPromise;
};
