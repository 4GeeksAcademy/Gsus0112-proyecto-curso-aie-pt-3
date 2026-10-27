import {
  EMPTY_FORM,
  PASSWORD_MAX_LENGTH,
  buildRegistrationPayload,
  isFieldName,
  parseApiError,
  validateRegistrationForm,
} from '../src/utils/authValidators';

describe('Validadores y parsers de autenticación (src/utils/authValidators.ts)', () => {
  // =====================================================================
  // 1. CAMINO FELIZ (Happy Path)
  // =====================================================================

  test('validateRegistrationForm acepta datos válidos y buildRegistrationPayload normaliza campos', () => {
    const input = {
      email: '  operador@trackflow.com  ',
      password: 'PasswordSegura123!',
      name: '  Elena Martín  ',
      phone: '   ',
      address: '',
    };

    expect(validateRegistrationForm(input)).toEqual({});
    expect(buildRegistrationPayload(input)).toEqual({
      email: 'operador@trackflow.com',
      password: 'PasswordSegura123!',
      name: 'Elena Martín',
      phone: null,
      address: null,
    });
  });

  test('isFieldName identifica correctamente los campos válidos del formulario', () => {
    expect(isFieldName('email')).toBe(true);
    expect(isFieldName('password')).toBe(true);
    expect(isFieldName('address')).toBe(true);
    expect(isFieldName('role')).toBe(false);
    expect(isFieldName(123)).toBe(false);
  });

  // =====================================================================
  // 2. CASOS LÍMITE (Edge Cases)
  // =====================================================================

  test('validateRegistrationForm acepta una contraseña en el límite exacto de 72 caracteres', () => {
    const errors = validateRegistrationForm({
      ...EMPTY_FORM,
      email: 'limite@trackflow.com',
      password: 'X'.repeat(PASSWORD_MAX_LENGTH),
    });
    expect(errors).toEqual({});
  });

  test('parseApiError asigna error específico al campo email ante un conflicto 409', async () => {
    const parsed = await parseApiError({
      status: 409,
      json: async () => ({ detail: 'Email already registered' }),
    });

    expect(parsed).toEqual({
      fieldErrors: { email: 'Este email ya está registrado.' },
      message: '',
    });
  });

  // =====================================================================
  // 3. MODOS DE FALLO (Failure Modes)
  // =====================================================================

  test('validateRegistrationForm rechaza email en blanco, contraseña vacía o mayor a 72 caracteres', () => {
    const emptyErrors = validateRegistrationForm({
      ...EMPTY_FORM,
      email: '   ',
      password: '',
    });
    expect(emptyErrors.email).toBe('El email es obligatorio.');
    expect(emptyErrors.password).toBe('La contraseña es obligatoria.');

    const overlongErrors = validateRegistrationForm({
      ...EMPTY_FORM,
      email: 'valido@trackflow.com',
      password: 'Y'.repeat(PASSWORD_MAX_LENGTH + 1),
    });
    expect(overlongErrors.password).toContain('72');
  });

  test('parseApiError mapea errores 422 de FastAPI por campo y agrupa errores generales', async () => {
    const parsed = await parseApiError({
      status: 422,
      json: async () => ({
        detail: [
          { loc: ['body', 'email'], msg: 'Formato de email inválido' },
          { loc: ['body', 'unknown_field'], msg: 'Error de esquema general' },
        ],
      }),
    });

    expect(parsed.fieldErrors).toEqual({ email: 'Formato de email inválido' });
    expect(parsed.message).toBe('Error de esquema general');
  });

  test('parseApiError oculta detalles internos en errores 500 o cuando el cuerpo JSON falla', async () => {
    const serverErr = await parseApiError({
      status: 500,
      json: async () => {
        throw new Error('Invalid JSON');
      },
    });

    expect(serverErr.fieldErrors).toEqual({});
    expect(serverErr.message).toContain('No pudimos completar el registro');
  });
});
