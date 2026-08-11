export type AuthUser = {
  id: string
  name: string
  email: string
}

export type AuthTokenResponse = {
  access_token: string
  token_type: string
  user: AuthUser
}

export type AccessTokenResponse = {
  access_token: string
  token_type: string
}

export type ApiErrorBody = {
  detail?: string | Array<{ msg?: string; loc?: unknown }>
}

export class ApiError extends Error {
  status: number
  body: unknown

  constructor(message: string, status: number, body?: unknown) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.body = body
  }
}
