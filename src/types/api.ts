export type Pagination = {
  totalPage: number
  currentPage: number
  hasPrevious: boolean
  hasNext: boolean
}

export type ApiErrorDetail = {
  field?: string
  code?: string
  message: string
}

export type ApiResponse<T> = {
  success: boolean
  message: string
  data?: T
  metadata?: Pagination
  errors?: ApiErrorDetail[]
}

export class ApiSuccessResponse<T> {
  public readonly success = true
  public readonly message: string
  public readonly data: T | null
  public readonly metadata?: Pagination

  constructor(message: string, data: T | null = null, metadata?: Pagination) {
    this.message = message
    this.data = data
    this.metadata = metadata
  }

  toJSON(): ApiResponse<T> {
    const response: ApiResponse<T> = {
      success: this.success,
      message: this.message
    }

    if (this.data !== null) {
      response.data = this.data
    }

    if (this.metadata) {
      response.metadata = this.metadata
    }

    return response
  }
}

export class ApiErrorResponse {
  public readonly success = false
  public readonly message: string
  public readonly errors?: ApiErrorDetail[]

  constructor(message: string, errors?: ApiErrorDetail[]) {
    this.message = message
    this.errors = errors
  }

  toJSON(): ApiResponse<never> {
    const response: ApiResponse<never> = {
      success: this.success,
      message: this.message
    }

    if (this.errors && this.errors.length > 0) {
      response.errors = this.errors
    }

    return response
  }
}

export class ApiResponseFactory {
  static success<T>(message: string, data: T): ApiSuccessResponse<T> {
    return new ApiSuccessResponse(message, data)
  }

  static paginated<T>(message: string, data: T, metadata: Pagination): ApiSuccessResponse<T> {
    return new ApiSuccessResponse(message, data, metadata)
  }

  static error(message: string, errors?: ApiErrorDetail[]): ApiErrorResponse {
    return new ApiErrorResponse(message, errors)
  }
}
