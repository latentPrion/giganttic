import {
  BadRequestException,
  Injectable,
  type PipeTransform,
} from "@nestjs/common";
import { ZodError, type ZodTypeAny } from "zod";

@Injectable()
export class ZodValidationPipe<TSchema extends ZodTypeAny>
  implements PipeTransform<unknown, unknown>
{
  constructor(private readonly schema: TSchema) {}

  transform(value: unknown): unknown {
    try {
      return this.schema.parse(value);
    } catch (error) {
      if (error instanceof ZodError) {
        throw new BadRequestException({
          message: "Validation failed",
          issues: error.issues,
        });
      }

      throw error;
    }
  }
}
