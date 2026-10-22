import { IsDefined, IsString, MaxLength, MinLength } from 'class-validator';

export class ThirdPartyChoiceDto {
  @IsString()
  @IsDefined()
  @MinLength(1)
  @MaxLength(200)
  value: string;
}
