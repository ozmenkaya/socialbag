import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

// the customer's answer on the approval page
export class ApprovalAnswerDto {
  @IsIn(['approve', 'revision'])
  action: 'approve' | 'revision';

  // what should change, required for a revision
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
