export type FieldName = 'email' | 'password' | 'name' | 'phone' | 'address';

export type FormValues = Record<FieldName, string>;

export type FieldErrors = Partial<Record<FieldName, string>>;

export type ValidationIssue = {
  loc: (string | number)[];
  msg: string;
};

export type RegistrationPayload = {
  email: string;
  password: string;
  name: string | null;
  phone: string | null;
  address: string | null;
};

export const PASSWORD_MAX_LENGTH = 72;

export const EMPTY_FORM: FormValues = {
  email: '',
  password: '',
  name: '',
  phone: '',
  address: '',
};

/** Comprueba si una clave pertenece al conjunto de campos del formulario de registro. */
export function isFieldName(value: unknown): value is FieldName {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(EMPTY_FORM, value);
}

/** Valida los campos obligatorios y límites de longitud antes de enviar el registro a la API. */
export function validateRegistrationForm(values: FormValues): FieldErrors {
  const errors: FieldErrors = {};
  if (!values.email.trim()) {
    errors.email = 'El email es obligatorio.';
  }
  if (!values.password) {
    errors.password = 'La contraseña es obligatoria.';
  } else if (values.password.length > PASSWORD_MAX_LENGTH) {
    errors.password = `La contraseña no puede superar ${PASSWORD_MAX_LENGTH} caracteres.`;
  }
  return errors;
}

/** Normaliza los valores del formulario recortando espacios y convirtiendo opcionales vacíos en null. */
export function buildRegistrationPayload(values: FormValues): RegistrationPayload {
  return {
    email: values.email.trim(),
    password: values.password,
    name: values.name.trim() || null,
    phone: values.phone.trim() || null,
    address: values.address.trim() || null,
  };
}

/** Convierte la respuesta de error de FastAPI en errores por campo y un mensaje general. */
export async function parseApiError(
  response: Pick<Response, 'status' | 'json'>,
): Promise<{ fieldErrors: FieldErrors; message: string }> {
  const body: unknown = await response.json().catch(() => null);
  const detail =
    body !== null && typeof body === 'object' && 'detail' in body
      ? (body as { detail: unknown }).detail
      : null;

  if (response.status === 409) {
    return { fieldErrors: { email: 'Este email ya está registrado.' }, message: '' };
  }

  if (response.status === 422 && Array.isArray(detail)) {
    const fieldErrors: FieldErrors = {};
    const general: string[] = [];
    for (const issue of detail as ValidationIssue[]) {
      const loc = issue?.loc ?? [];
      const field = loc[loc.length - 1];
      if (isFieldName(field)) {
        fieldErrors[field] ??= issue?.msg ?? 'Valor no válido.';
      } else if (issue?.msg) {
        general.push(issue.msg);
      }
    }
    return {
      fieldErrors,
      message: general.join(' ') || 'Revisa los campos marcados e inténtalo de nuevo.',
    };
  }

  return {
    fieldErrors: {},
    message:
      typeof detail === 'string' && response.status < 500
        ? detail
        : 'No pudimos completar el registro en este momento. Por favor, inténtalo de nuevo en unos segundos.',
  };
}
