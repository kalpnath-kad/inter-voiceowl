import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

/**
 * Validates UUID format (standard UUID v1-v7)
 * UUID format: 8-4-4-4-12 hexadecimal digits
 */
@ValidatorConstraint({ name: 'isUuid', async: false })
export class IsUuidConstraint implements ValidatorConstraintInterface {
  // Standard UUID regex (supports UUIDv1-v7)
  private readonly uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  validate(value: string, args: ValidationArguments): boolean {
    if (typeof value !== 'string') {
      return false;
    }
    
    return this.uuidRegex.test(value);
  }

  defaultMessage(args: ValidationArguments): string {
    return `${args.property} must be a valid UUID format`;
  }
}

/**
 * Validates that a string is a valid UUID format
 * @param validationOptions Optional validation options
 */
export function IsUuid(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsUuidConstraint,
    });
  };
}
