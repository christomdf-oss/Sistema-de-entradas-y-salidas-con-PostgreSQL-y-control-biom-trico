'use client';
import { useStudents } from '@/components/data/students-provider';
import { useTodayAttendance } from '@/components/data/today-attendance-provider';

import * as React from 'react';
import { PageHeader } from '@/components/page-header';
import AttendanceCalendar from './attendance-calendar';
import DailyAttendanceList from './daily-attendance-list';
import DailyAbsenceList from './daily-absence-list';
import JustifiedList from './justified-list';
import { isSameDay, format, startOfMonth, endOfMonth, addMonths, startOfDay, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { Student, Attendance, ProcessedAttendance } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Download, RefreshCw } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { dataApi, toAttendance } from '@/lib/api';
import type * as XLSX from 'xlsx';
import { Skeleton } from '@/components/ui/skeleton';
import { useRole } from '@/components/auth/use-role';
import { AttendanceMovements } from './attendance-movements';

export default function AttendancePage() {
  const { isAdmin, user } = useRole();
  const { toast } = useToast();

  const [historicalAttendance, setHistoricalAttendance] = React.useState<Attendance[]>([]);
  const { attendance: todayAttendance, day: currentDay } = useTodayAttendance();
  const { students: allStudents, loading, refreshStudents } = useStudents();
  const [selectedDate, setSelectedDate] = React.useState<Date>();

  React.useEffect(() => {
    setSelectedDate(new Date());
  }, []);

  const fetchData = React.useCallback(async () => {
    try {
      await refreshStudents();
      toast({ title: 'Alumnos actualizados', description: 'Las asistencias ya se actualizan automáticamente.' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'No se pudieron actualizar alumnos',
        description: error instanceof Error ? error.message : 'Comprueba la conexión.' });
    }
  }, [refreshStudents, toast]);

  const isViewingToday = !!selectedDate && isSameDay(selectedDate, currentDay);
  const attendanceData = isViewingToday ? todayAttendance : historicalAttendance;

  const [historicalRevision, setHistoricalRevision] = React.useState(0);
  React.useEffect(() => {
    if (!selectedDate || isViewingToday) return;
    let active = true;
    setHistoricalAttendance([]);
    const date = format(selectedDate, 'yyyy-MM-dd');
    void dataApi<{attendance: any[]}>(`attendance?date=${encodeURIComponent(date)}`)
      .then(result => {if(active)setHistoricalAttendance(result.attendance.map(toAttendance));})
      .catch(error => {if(active)toast({variant:'destructive',title:'No se pudo cargar la asistencia',
        description:error instanceof Error?error.message:'Error de conexión'});});
    return () => { active = false; };
  }, [toast, selectedDate?.toDateString(), isViewingToday, historicalRevision]);

  const {refreshAttendance} = useTodayAttendance();
  const voidAttendance = async (record: Attendance, reason: string) => {
    if (!user || !isAdmin) throw new Error('Solo el administrador puede anular registros');
    await dataApi(`attendance/${encodeURIComponent(record.id)}/void`, {
      method: 'POST', body: JSON.stringify({reason}),
    });
    if (isViewingToday) await refreshAttendance();
    else setHistoricalRevision(v => v + 1);
    toast({ title:'Registro anulado',description:'El historial se conserva para auditoría.' });
  };

  const processedAttendance = React.useMemo(() => {
    if (!attendanceData || !allStudents || !selectedDate) return [];
    const attendanceForSelectedDay = attendanceData.filter((a) =>
      !a.voided && isSameDay(a.timestamp, selectedDate)
    );
    const studentsById = new Map(allStudents.map((s) => [s.id, s]));
    const attendanceByStudent = new Map<
      string,
      { entrada: Date | null; salida: Date | null }
    >();

    for (const item of attendanceForSelectedDay) {
      if (!studentsById.has(item.studentId)) continue;
      if (!attendanceByStudent.has(item.studentId)) {
        attendanceByStudent.set(item.studentId, {
          entrada: null,
          salida: null,
        });
      }
      const studentRecords = attendanceByStudent.get(item.studentId)!;

      if (item.type === 'entrada') {
        if (!studentRecords.entrada || item.timestamp < studentRecords.entrada) {
          studentRecords.entrada = item.timestamp;
        }
      } else if (item.type === 'salida') {
        if (!studentRecords.salida || item.timestamp > studentRecords.salida) {
          studentRecords.salida = item.timestamp;
        }
      }
    }

    const result: ProcessedAttendance[] = [];
    for (const [studentId, times] of attendanceByStudent.entries()) {
      const student = studentsById.get(studentId);
      if (student && (times.entrada || times.salida)) {
        result.push({
          studentId,
          studentName: student.nombre,
          grupo: student.grupo,
          entrada: times.entrada,
          salida: times.salida,
        });
      }
    }

    result.sort((a, b) => a.studentName.localeCompare(b.studentName));
    return result;
  }, [attendanceData, allStudents, selectedDate]);

  const absentStudents = React.useMemo(() => {
    if (!allStudents || !selectedDate) return [];
    const presentStudentIds = new Set(
      processedAttendance.map((a) => a.studentId)
    );
    return allStudents
      .filter((student) => student.id && !presentStudentIds.has(student.id))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [allStudents, processedAttendance, selectedDate]);

  const justifiedRecords = React.useMemo(() => {
    if (!attendanceData || !selectedDate) return [];
    return attendanceData
      .filter((a) => !a.voided && a.isManual && isSameDay(a.timestamp, selectedDate))
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }, [attendanceData, selectedDate]);

  const daysWithAttendance = React.useMemo(() => {
    if (!attendanceData) return new Set();
    return new Set(attendanceData.filter(a => !a.voided).map((a) => a.timestamp.toDateString()));
  }, [attendanceData]);

  const handleExport = async (exportType: 'day' | 'month' | 'absent_day') => {
    if (!allStudents || !attendanceData || !selectedDate) {
      toast({
        variant: 'destructive',
        title: 'Datos no cargados',
        description: `Espera a que los datos se carguen antes de exportar.`,
      });
      return;
    }

    const XLSX = await import('xlsx');
    const studentsById = new Map(allStudents.map((s) => [s.id, s]));
    let dateForFilename: string;

    if (exportType === 'absent_day') {
      const dataToExport = absentStudents;
      dateForFilename = format(selectedDate, 'yyyy-MM-dd');

      if (dataToExport.length === 0) {
        toast({
          title: 'No hay ausentes',
          description:
            'Todos los alumnos registraron asistencia en el día seleccionado.',
        });
        return;
      }

      const groupedByGrupo = dataToExport.reduce((acc, student) => {
        const group = student.grupo;
        if (!acc[group]) {
          acc[group] = [];
        }
        acc[group].push(student);
        return acc;
      }, {} as Record<string, typeof dataToExport>);

      const wb = XLSX.utils.book_new();

      const summaryJson = [
        {
          A: 'Fecha del Reporte',
          B: format(selectedDate, "d 'de' MMMM 'de' yyyy", { locale: es }),
        },
        { A: 'Total de Alumnos Ausentes', B: dataToExport.length },
      ];

      const summaryWs = XLSX.utils.json_to_sheet(summaryJson, {
        skipHeader: true,
      });
      XLSX.utils.book_append_sheet(wb, summaryWs, 'Resumen');

      Object.keys(groupedByGrupo)
        .sort()
        .forEach((group) => {
          const groupData = groupedByGrupo[group];
          const json_data = groupData.map((student) => ({
            Alumno: student.nombre,
            Matrícula: student.id,
            Comunidad: student.comunidad,
            'Teléfono del Tutor': student.telefono_tutor,
          }));

          const ws = XLSX.utils.json_to_sheet(json_data);
          XLSX.utils.book_append_sheet(wb, ws, `Grupo ${group}`);
        });

      XLSX.writeFile(wb, `reporte_ausencias_${dateForFilename}.xlsx`);
    } else if (exportType === 'day') {
      const dataToExport = processedAttendance;
      dateForFilename = format(selectedDate, 'yyyy-MM-dd');

      if (dataToExport.length === 0) {
        toast({
          title: 'No hay datos para exportar',
          description:
            'No se encontraron registros de asistencia para el día seleccionado.',
        });
        return;
      }

      const groupedByGrupo = dataToExport.reduce((acc, item) => {
        const group = item.grupo;
        if (!acc[group]) {
          acc[group] = [];
        }
        acc[group].push(item);
        return acc;
      }, {} as Record<string, typeof dataToExport>);

      const wb = XLSX.utils.book_new();

      Object.keys(groupedByGrupo)
        .sort()
        .forEach((group) => {
          const groupData = groupedByGrupo[group];
          const json_data = groupData.map((item) => ({
            Alumno: item.studentName,
            Entrada: item.entrada
              ? format(item.entrada, 'p', { locale: es })
              : 'Sin registro',
            Salida: item.salida
              ? format(item.salida, 'p', { locale: es })
              : 'Sin registro',
          }));

          const ws = XLSX.utils.json_to_sheet(json_data);
          XLSX.utils.book_append_sheet(wb, ws, `Grupo ${group}`);
        });

      XLSX.writeFile(wb, `asistencia_diaria_${dateForFilename}.xlsx`);
    } else {
      // 'month' export
      const monthStart = startOfMonth(selectedDate);
      const monthEnd = endOfMonth(selectedDate);
      dateForFilename = format(monthStart, 'yyyy-MM');

      // Solo al elegir "Exportar Reporte Mensual" se consulta el mes completo.
      // Abrir el calendario o moverse entre días NUNCA descarga el mes.
      let attendanceForMonth: Attendance[];
      try {
        const result = await dataApi<{attendance:any[]}>(`attendance?month=${format(monthStart,'yyyy-MM')}`);
        attendanceForMonth = result.attendance.map(toAttendance).filter(a => !a.voided);
      } catch (err) {
        toast({ variant:'destructive', title:'No se pudo exportar el mes',
          description:err instanceof Error?err.message:'Error de conexión' });
        return;
      }

      if (attendanceForMonth.length === 0) {
        toast({
          variant: 'destructive',
          title: 'No hay datos para exportar',
          description: `No se encontraron registros para el mes seleccionado.`,
        });
        return;
      }

      const wb = XLSX.utils.book_new();

      // --- START: Summary Sheet Logic ---
      const schoolDaysInMonth = new Set(
        attendanceForMonth.map((a) => a.timestamp.toDateString())
      );
      const totalSchoolDays = schoolDaysInMonth.size;

      const studentSummaryData = allStudents
        .map((student) => {
          if (!student.id) return null;
          const studentAttendanceInMonth = attendanceForMonth.filter(
            (a) => a.studentId === student.id
          );
          const attendedDays = new Set(
            studentAttendanceInMonth
              .filter((a) => a.type === 'entrada')
              .map((a) => a.timestamp.toDateString())
          );

          let lateEntries = 0;
          const lateEntryThresholdMinutes = 15; // After 8:15 AM is late

          studentAttendanceInMonth.forEach((a) => {
            if (a.type === 'entrada') {
              if (
                a.timestamp.getHours() > 8 ||
                (a.timestamp.getHours() === 8 &&
                  a.timestamp.getMinutes() > lateEntryThresholdMinutes)
              ) {
                lateEntries++;
              }
            }
          });

          const daysAttended = attendedDays.size;
          const absences = totalSchoolDays - daysAttended;
          const attendancePercentage =
            totalSchoolDays > 0 ? (daysAttended / totalSchoolDays) * 100 : 0;

          return {
            Alumno: student.nombre,
            Grupo: student.grupo,
            Comunidad: student.comunidad,
            'Días Asistidos': daysAttended,
            Ausencias: absences,
            '% Asistencia': attendancePercentage, // Kept as number for calculations
            'Entradas Tardías': lateEntries,
          };
        })
        .filter((s) => s !== null) as NonNullable<
        typeof studentSummaryData[0]
      >[];

      const groupAvgAttendance: Record<
        string,
        { total: number; count: number }
      > = {};
      studentSummaryData.forEach((s) => {
        if (!groupAvgAttendance[s.Grupo]) {
          groupAvgAttendance[s.Grupo] = { total: 0, count: 0 };
        }
        groupAvgAttendance[s.Grupo].total += s['% Asistencia'];
        groupAvgAttendance[s.Grupo].count++;
      });

      const groupSummaryJson = Object.keys(groupAvgAttendance)
        .sort()
        .map((group) => ({
          Grupo: group,
          '% Asistencia Promedio': `${(
            groupAvgAttendance[group].total / groupAvgAttendance[group].count
          ).toFixed(1)}%`,
        }));

      const studentSummaryJson = studentSummaryData
        .map((s) => ({
          ...s,
          '% Asistencia': `${s['% Asistencia'].toFixed(1)}%`,
          'Requiere Atención': s['% Asistencia'] < 80 ? 'Sí' : 'No',
        }))
        .sort(
          (a, b) =>
            a.Grupo.localeCompare(b.Grupo) || a.Alumno.localeCompare(b.Alumno)
        );

      const summaryWs = XLSX.utils.json_to_sheet(studentSummaryJson);
      XLSX.utils.sheet_add_json(summaryWs, [{}], { origin: -1 });
      XLSX.utils.sheet_add_json(
        summaryWs,
        [{ 'Resumen por Grupo': '' }],
        { origin: -1, skipHeader: true }
      );
      XLSX.utils.sheet_add_json(summaryWs, groupSummaryJson, { origin: -1 });

      XLSX.utils.book_append_sheet(wb, summaryWs, 'Resumen Mensual');

      // --- END: Summary Sheet Logic ---

      // --- START: Detailed Sheets Logic ---
      const monthlyData = new Map<
        string,
        Map<string, { entrada: Date | null; salida: Date | null }>
      >();

      for (const item of attendanceForMonth) {
        if (!item.studentId) continue;
        const dayString = item.timestamp.toDateString();
        if (!monthlyData.has(dayString)) {
          monthlyData.set(dayString, new Map());
        }
        const dayData = monthlyData.get(dayString)!;

        if (!dayData.has(item.studentId)) {
          dayData.set(item.studentId, { entrada: null, salida: null });
        }
        const studentRecords = dayData.get(item.studentId)!;

        if (item.type === 'entrada') {
          if (
            !studentRecords.entrada ||
            item.timestamp < studentRecords.entrada
          ) {
            studentRecords.entrada = item.timestamp;
          }
        } else if (item.type === 'salida') {
          if (!studentRecords.salida || item.timestamp > studentRecords.salida) {
            studentRecords.salida = item.timestamp;
          }
        }
      }

      const flatMonthData: (ProcessedAttendance & { date: Date })[] = [];
      for (const [dayString, dayData] of monthlyData.entries()) {
        for (const [studentId, times] of dayData.entries()) {
          const student = studentsById.get(studentId);
          if (student) {
            flatMonthData.push({
              date: new Date(dayString),
              studentId: student.id,
              studentName: student.nombre,
              grupo: student.grupo,
              ...times,
            });
          }
        }
      }
      const dataToExport = flatMonthData.sort(
        (a, b) =>
          a.date.getTime() - b.date.getTime() ||
          a.studentName.localeCompare(b.studentName)
      );

      const groupedByGrupo = dataToExport.reduce((acc, item) => {
        const group = item.grupo;
        if (!acc[group]) {
          acc[group] = [];
        }
        acc[group].push(item);
        return acc;
      }, {} as Record<string, typeof dataToExport>);

      Object.keys(groupedByGrupo)
        .sort()
        .forEach((group) => {
          const groupData = groupedByGrupo[group];
          const json_data = groupData.map((item) => ({
            Fecha: item.date
              ? format(item.date, 'eeee dd, MMMM', { locale: es })
              : '',
            Alumno: item.studentName,
            Entrada: item.entrada
              ? format(item.entrada, 'p', { locale: es })
              : 'Sin registro',
            Salida: item.salida
              ? format(item.salida, 'p', { locale: es })
              : 'Sin registro',
          }));

          const ws = XLSX.utils.json_to_sheet(json_data);
          XLSX.utils.book_append_sheet(wb, ws, `Grupo ${group}`);
        });
      // --- END: Detailed Sheets Logic ---

      XLSX.writeFile(wb, `reporte_mensual_asistencia_${dateForFilename}.xlsx`);
    }
  };

  if (!selectedDate || loading) {
    return (
      <div className="container mx-auto py-2">
        <PageHeader
          title="Asistencia"
          description="Visualiza historial y gestiona el modo de asistencia en tiempo real."
        >
          <div className="flex items-center gap-2">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-28" />
          </div>
        </PageHeader>
        <Card>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-0">
            <div className="md:col-span-1 md:border-r">
              <div className="p-6">
                <div className="flex flex-row items-center justify-between pb-6">
                  <Skeleton className="h-7 w-32" />
                  <div className="flex gap-2">
                    <Skeleton className="h-10 w-10" />
                    <Skeleton className="h-10 w-10" />
                  </div>
                </div>
                <div className="grid grid-cols-7 gap-2 text-center">
                  {Array.from({ length: 7 }).map((_, i) => (
                    <div
                      key={i}
                      className="text-sm font-medium text-muted-foreground h-4 w-4 mx-auto"
                    >
                      {['D', 'L', 'M', 'X', 'J', 'V', 'S'][i]}
                    </div>
                  ))}
                  {Array.from({ length: 35 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-10 rounded-full" />
                  ))}
                </div>
              </div>
            </div>
            <div className="md:col-span-2">
              <div className="p-6">
                <Skeleton className="h-10 w-full mb-6" />
                <div className="space-y-6">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex items-start gap-4">
                      <Skeleton className="h-9 w-9 rounded-full" />
                      <div className="grid gap-1.5 w-full">
                        <div className="flex justify-between items-center">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-3 w-20" />
                        </div>
                        <div className="flex flex-col gap-2 pt-1">
                          <Skeleton className="h-4 w-40" />
                          <Skeleton className="h-4 w-40" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-2">
      <PageHeader
        title="Asistencia"
        description="Selecciona una fecha para revisar los registros del día."
      >
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refrescar
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button disabled={loading}>
                <Download className="mr-2 h-4 w-4" />
                Exportar
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => handleExport('day')}>
                Exportar Asistencia del Día
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('absent_day')}>
                Exportar Ausentes del Día
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('month')}>
                Exportar Reporte Mensual
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </PageHeader>
      <Card>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-0">
          <div className="md:col-span-1 md:border-r">
            <AttendanceCalendar
              selectedDate={selectedDate}
              onDateChange={setSelectedDate}
              daysWithAttendance={daysWithAttendance}
            />
            <p className="px-6 pb-4 text-xs text-muted-foreground">Para ahorrar lecturas, los indicadores corresponden al día consultado. Selecciona cualquier fecha para ver su asistencia.</p>
          </div>
          <div className="md:col-span-2">
            <Tabs defaultValue="presentes" className="w-full">
              <div className="p-6 pb-0">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="presentes">
                    Presentes ({processedAttendance.length})
                  </TabsTrigger>
                  <TabsTrigger value="ausentes">
                    Ausentes ({absentStudents.length})
                  </TabsTrigger>
                  <TabsTrigger value="movimientos">
                    Movimientos ({attendanceData.filter(a => selectedDate && isSameDay(a.timestamp, selectedDate)).length})
                  </TabsTrigger>
                  <TabsTrigger value="manuales">
                    Manuales ({justifiedRecords.length})
                  </TabsTrigger>
                </TabsList>
              </div>
              <TabsContent value="presentes">
                <DailyAttendanceList
                  date={selectedDate}
                  processedAttendance={processedAttendance}
                />
              </TabsContent>
              <TabsContent value="ausentes">
                <DailyAbsenceList
                  date={selectedDate}
                  absentStudents={absentStudents}
                />
              </TabsContent>
              <TabsContent value="movimientos">
                <AttendanceMovements records={attendanceData.filter(a => selectedDate && isSameDay(a.timestamp, selectedDate) && allStudents.some(s => s.id === a.studentId))} isAdmin={isAdmin} onVoid={voidAttendance} />
              </TabsContent>
              <TabsContent value="manuales">
                <JustifiedList
                  date={selectedDate}
                  justifiedRecords={justifiedRecords}
                />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </Card>
    </div>
  );
}
