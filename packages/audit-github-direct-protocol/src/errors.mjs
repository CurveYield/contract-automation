export class DirectValidationError extends Error{
  constructor(code,path,message=code){super(message);this.name='DirectValidationError';this.code=code;this.path=path;}
}
export function fail(code,path,message=code){throw new DirectValidationError(code,path,message);}
