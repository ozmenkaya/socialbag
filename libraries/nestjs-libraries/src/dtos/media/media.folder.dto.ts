import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDefined,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateMediaFolderDto {
  @IsDefined()
  @IsString()
  @Length(1, 100)
  name: string;

  @IsOptional()
  @IsString()
  parentId?: string;
}

export class UpdateMediaFolderDto {
  @IsOptional()
  @IsString()
  @Length(1, 100)
  name?: string;

  // null moves the folder to the top level
  @IsOptional()
  @IsString()
  parentId?: string | null;
}

export class MediaFolderIntegrationsDto {
  @IsDefined()
  @IsArray()
  @IsString({ each: true })
  integrations: string[];
}

export class MoveMediaDto {
  @IsDefined()
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  media: string[];

  // null moves the media outside of any folder
  @IsOptional()
  @IsString()
  folderId?: string | null;
}

export class MediaFolderAutoPostDto {
  @IsDefined()
  @IsBoolean()
  enabled: boolean;

  // 0 = Sunday ... 6 = Saturday, in the folder's timezone
  @IsDefined()
  @IsArray()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  days: number[];

  @IsDefined()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  time: string;

  @IsDefined()
  @IsString()
  @Length(1, 64)
  timezone: string;

  // {name} is replaced with the file name
  @IsDefined()
  @IsString()
  @MaxLength(5000)
  content: string;

  @IsOptional()
  @IsIn(['post', 'story', 'trial_reel'])
  format?: 'post' | 'story' | 'trial_reel';
}
