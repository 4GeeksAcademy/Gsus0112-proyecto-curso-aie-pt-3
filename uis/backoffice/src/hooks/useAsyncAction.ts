import { useCallback, useState } from 'react';

export interface UseAsyncActionOptions<T> {
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
}

export interface AsyncActionState<T> {
  isLoading: boolean;
  error: string | null;
  successMessage: string | null;
  data: T | null;
}

/**
 * Custom Hook para gestionar operaciones asíncronas con 3 estados visibles
 * (cargando, éxito, error), evitando código duplicado en formularios y paneles.
 */
export function useAsyncAction<T, P extends unknown[] = unknown[]>(
  actionFn: (...args: P) => Promise<T>,
  options: UseAsyncActionOptions<T> = {},
) {
  const [state, setState] = useState<AsyncActionState<T>>({
    isLoading: false,
    error: null,
    successMessage: null,
    data: null,
  });

  const execute = useCallback(
    async (...args: P): Promise<T | null> => {
      setState((prev) => ({
        ...prev,
        isLoading: true,
        error: null,
        successMessage: null,
      }));

      try {
        const result = await actionFn(...args);
        setState({
          isLoading: false,
          error: null,
          successMessage: 'Operación completada con éxito.',
          data: result,
        });
        if (options.onSuccess) {
          options.onSuccess(result);
        }
        return result;
      } catch (err: unknown) {
        const message =
          err instanceof Error
            ? err.message
            : 'Ocurrió un error inesperado al procesar la solicitud.';
        setState({
          isLoading: false,
          error: message,
          successMessage: null,
          data: null,
        });
        if (options.onError && err instanceof Error) {
          options.onError(err);
        }
        return null;
      }
    },
    [actionFn, options],
  );

  const reset = useCallback(() => {
    setState({
      isLoading: false,
      error: null,
      successMessage: null,
      data: null,
    });
  }, []);

  const setCustomError = useCallback((message: string | null) => {
    setState((prev) => ({ ...prev, error: message }));
  }, []);

  const setCustomSuccess = useCallback((message: string | null) => {
    setState((prev) => ({ ...prev, successMessage: message }));
  }, []);

  return {
    ...state,
    execute,
    reset,
    setError: setCustomError,
    setSuccessMessage: setCustomSuccess,
  };
}
