'use client';
import { useStudents } from '@/components/data/students-provider';
import { useTodayAttendance } from '@/components/data/today-attendance-provider';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, LogIn, History } from 'lucide-react';
import StatCard from '@/components/dashboard/stat-card';
import AttendanceFeed from '@/components/dashboard/attendance-feed';
import type { Attendance } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { isSameDay, startOfDay, addDays } from 'date-fns';

export default function DashboardPage() {
  const { students, loading: studentsLoading } = useStudents();
  const { attendance: todayAttendance, loading: attendanceLoading, day } = useTodayAttendance();
  const attendance = React.useMemo(() => todayAttendance.filter(a => !a.voided), [todayAttendance]);
  const today = day;


  const { presentToday, eventsToday } = React.useMemo(() => {
    if (!attendance || !today) { // Check for today
      return { presentToday: 0, eventsToday: 0 };
    }
    
    const activeStudentIds = new Set(students.map(s => s.id));
    const todaysAttendance = attendance.filter(a => a.timestamp && isSameDay(a.timestamp, today) && activeStudentIds.has(a.studentId)); // use today
    const eventsToday = todaysAttendance.length;

    const presentIds = new Set(
      todaysAttendance
        .filter(a => a.type === 'entrada')
        .map(a => a.studentId)
    );
    const presentToday = presentIds.size;

    return { presentToday, eventsToday };
  }, [attendance, today, students]); // add today to dependencies
  
  const StatCardSkeleton = () => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-4 w-4" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-3 w-full mt-2" />
      </CardContent>
    </Card>
  )

  if (studentsLoading || attendanceLoading || !today) { // Check for !today
     return (
        <div className="flex flex-col gap-6">
            <div className="grid gap-4 md:grid-cols-3">
                <StatCardSkeleton />
                <StatCardSkeleton />
                <StatCardSkeleton />
            </div>
             <div className="grid gap-6 lg:grid-cols-1">
                <Card>
                    <CardHeader>
                        <CardTitle>Registro de Asistencia en Vivo</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {Array.from({ length: 10 }).map((_, i) => (
                            <div key={i} className="flex items-center gap-4">
                                <Skeleton className="h-9 w-9 rounded-full" />
                                <div className="grid gap-1.5 flex-1">
                                    <Skeleton className="h-4 w-32" />
                                    <Skeleton className="h-3 w-24" />
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            </div>
        </div>
     )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="Total de Alumnos"
          value={students.length}
          icon={Users}
          description="Alumnos registrados en total"
        />
        <StatCard
          title="Presentes Hoy"
          value={presentToday}
          icon={LogIn}
          description="Alumnos que han entrado hoy"
        />
        <StatCard
          title="Eventos de Hoy"
          value={eventsToday}
          icon={History}
          description="Eventos de entrada/salida de hoy"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-1">
        <Card>
          <CardHeader>
            <CardTitle>Registro de Asistencia en Vivo</CardTitle>
          </CardHeader>
          <CardContent>
            <AttendanceFeed attendance={(attendance ?? []).filter(a => students.some(s => s.id === a.studentId)).slice(0, 10)} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
