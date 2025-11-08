import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength, Matches } from 'class-validator';

export class RoleDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  @Matches(/^[a-z0-9_\-]+$/i, { message: 'role name must be alphanumeric/underscore/dash' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  name: string;
}
