import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStudentSurveyDto } from './dto/create-student-survey.dto';
import { CreateTutorSurveyDto } from './dto/create-tutor-survey.dto';

@Injectable()
export class SurveyService {
  constructor(private readonly prisma: PrismaService) {}

  createStudent(dto: CreateStudentSurveyDto) {
    return this.prisma.studentSurvey.create({
      data: {
        school: dto.school,
        faculty: dto.faculty,
        department: dto.department,
        level: dto.level,
        struggled: dto.struggled,
        courses: dto.courses ?? [],
        runTo: dto.runTo,
        wished: dto.wished,
        wouldUse: dto.wouldUse,
        rate: dto.rate,
        trust: dto.trust ?? [],
        timing: dto.timing,
        format: dto.format,
        feature: dto.feature,
        suggestions: dto.suggestions,
      },
    });
  }

  createTutor(dto: CreateTutorSurveyDto) {
    return this.prisma.tutorSurvey.create({
      data: {
        school: dto.school,
        faculty: dto.faculty,
        department: dto.department,
        level: dto.level,
        helped: dto.helped,
        canTeach: dto.canTeach,
        interested: dto.interested,
        why: dto.why ?? [],
        earn: dto.earn,
        format: dto.format,
        stopYou: dto.stopYou,
        join: dto.join,
        feature: dto.feature,
        suggestions: dto.suggestions,
      },
    });
  }

  listStudents() {
    return this.prisma.studentSurvey.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  listTutors() {
    return this.prisma.tutorSurvey.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async stats() {
    const [students, tutors] = await Promise.all([
      this.prisma.studentSurvey.count(),
      this.prisma.tutorSurvey.count(),
    ]);
    return { students, tutors, total: students + tutors };
  }
}
