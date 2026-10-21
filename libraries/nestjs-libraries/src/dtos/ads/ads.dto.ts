import {
  ArrayMinSize,
  IsArray,
  IsDefined,
  IsIn,
  IsInt,
  IsNumber,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';

export class ConnectAdsDto {
  @IsDefined()
  @IsString()
  code: string;

  @IsDefined()
  @IsString()
  state: string;
}

export class CreateBoostDto {
  @IsDefined()
  @IsString()
  postId: string;

  @IsDefined()
  @IsString()
  connectionId: string;

  @IsDefined()
  @IsString()
  adAccountId: string;

  @IsDefined()
  @IsIn(['engagement', 'awareness'])
  objective: 'engagement' | 'awareness';

  @IsDefined()
  @IsNumber()
  @Min(1)
  dailyBudget: number;

  @IsDefined()
  @IsInt()
  @Min(1)
  @Max(90)
  days: number;

  @IsDefined()
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  @Length(2, 2, { each: true })
  countries: string[];

  @IsDefined()
  @IsInt()
  @Min(18)
  @Max(65)
  ageMin: number;

  @IsDefined()
  @IsInt()
  @Min(18)
  @Max(65)
  ageMax: number;

  @IsDefined()
  @IsIn(['NONE', 'HOUSING'])
  specialAdCategory: 'NONE' | 'HOUSING';
}

export class BoostStatusDto {
  @IsDefined()
  @IsIn(['ACTIVE', 'PAUSED'])
  status: 'ACTIVE' | 'PAUSED';
}
