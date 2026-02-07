import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { subDays, addDays, startOfDay } from 'npm:date-fns@3.6.0';

// Semana começa na terça-feira e termina na segunda-feira
const getWeekBounds = (date) => {
  const dateObj = new Date(date);
  const dayOfWeek = dateObj.getDay();
  
  let daysToTuesday;
  if (dayOfWeek === 0) {
    daysToTuesday = 5;
  } else if (dayOfWeek === 1) {
    daysToTuesday = 6;
  } else {
    daysToTuesday = dayOfWeek - 2;
  }
  
  const weekStart = subDays(startOfDay(dateObj), daysToTuesday);
  const weekEnd = addDays(weekStart, 6);
  
  return { start: weekStart, end: weekEnd };
};

const getWeekNumber = (date) => {
  const dateObj = new Date(date);
  const yearStart = new Date(dateObj.getFullYear(), 0, 1);
  
  const firstTuesday = yearStart.getDay() <= 2 
    ? addDays(yearStart, 2 - yearStart.getDay()) 
    : addDays(yearStart, 9 - yearStart.getDay());
  
  const weekBounds = getWeekBounds(dateObj);
  const diffTime = weekBounds.start.getTime() - firstTuesday.getTime();
  const diffWeeks = Math.floor(diffTime / (7 * 24 * 60 * 60 * 1000));
  
  return diffWeeks + 1;
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { date } = body;

    if (!date) {
      return Response.json({ error: 'Missing date parameter' }, { status: 400 });
    }

    console.log(`📅 Calculando semana para data: ${date}`);
    
    const weekNumber = getWeekNumber(date);
    const year = new Date(date).getFullYear();
    const weekBounds = getWeekBounds(date);
    
    const result = {
      numero_semana: weekNumber,
      ano: year,
      data_inicio: weekBounds.start.toISOString().split('T')[0],
      data_fim: weekBounds.end.toISOString().split('T')[0]
    };

    console.log(`✅ Semana calculada:`, result);
    
    return Response.json(result);
  } catch (error) {
    console.error('❌ Erro ao buscar semana atual:', error.message);
    return Response.json({ 
      error: error.message
    }, { status: 500 });
  }
});