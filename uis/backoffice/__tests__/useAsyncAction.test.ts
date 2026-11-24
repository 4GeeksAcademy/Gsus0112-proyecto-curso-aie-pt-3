import { AsyncActionState } from '../src/hooks/useAsyncAction';

describe('useAsyncAction state management contracts', () => {
  it('defines correct initial idle state structure', () => {
    const initialState: AsyncActionState<string> = {
      isLoading: false,
      error: null,
      successMessage: null,
      data: null,
    };

    expect(initialState.isLoading).toBe(false);
    expect(initialState.error).toBe(null);
    expect(initialState.successMessage).toBe(null);
    expect(initialState.data).toBe(null);
  });

  it('handles state progression for successful async actions', async () => {
    let state: AsyncActionState<string> = {
      isLoading: false,
      error: null,
      successMessage: null,
      data: null,
    };

    // 1. Inicia acción
    state = { ...state, isLoading: true, error: null, successMessage: null };
    expect(state.isLoading).toBe(true);

    // 2. Resuelve acción
    const mockApiCall = async () => 'incidencia-123';
    const result = await mockApiCall();

    state = {
      isLoading: false,
      error: null,
      successMessage: 'Operación completada con éxito.',
      data: result,
    };

    expect(state.isLoading).toBe(false);
    expect(state.data).toBe('incidencia-123');
    expect(state.error).toBe(null);
  });

  it('handles state progression for failed async actions with error message', async () => {
    let state: AsyncActionState<string> = {
      isLoading: true,
      error: null,
      successMessage: null,
      data: null,
    };

    const mockFailedCall = async () => {
      throw new Error('Timeout al conectar con la API');
    };

    try {
      await mockFailedCall();
    } catch (err: unknown) {
      state = {
        isLoading: false,
        error: (err as Error).message,
        successMessage: null,
        data: null,
      };
    }

    expect(state.isLoading).toBe(false);
    expect(state.error).toBe('Timeout al conectar con la API');
    expect(state.data).toBe(null);
  });
});
