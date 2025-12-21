import { Interceptor } from '@connectrpc/connect'
import { createValidator } from '@bufbuild/protovalidate'
import { ConnectError, Code } from '@connectrpc/connect'

export function createValidationInterceptor(): Interceptor {
  const validator = createValidator()

  return next => async req => {
    // Unary Request
    if (!req.stream) {
      try {
        const result = validator.validate(req.method.input, req.message as any)

        if (result.kind === 'invalid') {
          const errors =
            result.violations
              .map(v => {
                const path = v.field
                  ?.map(f => ('name' in f ? f.name : ''))
                  .join('.')
                return `${path}: ${v.message}`
              })
              .join(', ') || 'Validation failed'

          throw new ConnectError(
            `Validation failed: ${errors}`,
            Code.InvalidArgument,
          )
        }
      } catch (error) {
        if (error instanceof ConnectError) {
          throw error
        }
        console.error('Validation error:', error)
      }
      return await next(req)
    }

    // Streaming Request (Client, Server, or BiDi)
    if (req.stream) {
      const originalStream = req.message
      const validatedStream = (async function* () {
        for await (const chunk of originalStream) {
          try {
            const result = validator.validate(req.method.input, chunk as any)

            if (result.kind === 'invalid') {
              const errors =
                result.violations
                  .map(v => {
                    const path = v.field
                      ?.map(f => ('name' in f ? f.name : ''))
                      .join('.')
                    return `${path}: ${v.message}`
                  })
                  .join(', ') || 'Validation failed'

              throw new ConnectError(
                `Streaming validation failed: ${errors}`,
                Code.InvalidArgument,
              )
            }

            yield chunk
          } catch (error) {
            if (error instanceof ConnectError) {
              throw error
            }
            console.error('Streaming validation error:', error)
            yield chunk
          }
        }
      })()

      // Return next with a NEW request object containing the wrapped message
      return await next({
        ...req,
        message: validatedStream,
      } as any)
    }

    return await next(req)
  }
}
