import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class ClientDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @IsString()
  @MaxLength(40)
  username: string;

  // empty: generated on create, left as it was on edit
  @IsOptional()
  @IsString()
  @MaxLength(100)
  password?: string;

  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  projectIds: string[];
}

export class PortalLoginDto {
  @IsString()
  @MaxLength(40)
  username: string;

  @IsString()
  @MaxLength(100)
  password: string;

  @IsOptional()
  @IsBoolean()
  remember?: boolean;
}

export class PortalPostsQueryDto {
  @IsOptional()
  @IsString()
  projectId?: string;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;
}

export class PortalAnswerDto {
  @IsIn(['approve', 'revision'])
  action: 'approve' | 'revision';

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}

export class PortalPasswordDto {
  @IsString()
  @MaxLength(100)
  current: string;

  @IsString()
  @MinLength(6)
  @MaxLength(100)
  password: string;
}
