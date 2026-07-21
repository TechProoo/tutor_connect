import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { SurveyService } from './survey.service';
import { CreateStudentSurveyDto } from './dto/create-student-survey.dto';
import { CreateTutorSurveyDto } from './dto/create-tutor-survey.dto';
import { AdminKeyGuard } from './admin-key.guard';

@Controller('survey')
export class SurveyController {
  constructor(private readonly survey: SurveyService) {}

  @Post('student')
  @HttpCode(HttpStatus.CREATED)
  createStudent(@Body() dto: CreateStudentSurveyDto) {
    return this.survey.createStudent(dto);
  }

  @Post('tutor')
  @HttpCode(HttpStatus.CREATED)
  createTutor(@Body() dto: CreateTutorSurveyDto) {
    return this.survey.createTutor(dto);
  }

  @Get('stats')
  @UseGuards(AdminKeyGuard)
  stats() {
    return this.survey.stats();
  }

  @Get('student')
  @UseGuards(AdminKeyGuard)
  listStudents() {
    return this.survey.listStudents();
  }

  @Get('tutor')
  @UseGuards(AdminKeyGuard)
  listTutors() {
    return this.survey.listTutors();
  }
}
