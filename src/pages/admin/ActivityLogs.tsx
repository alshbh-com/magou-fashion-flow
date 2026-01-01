import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Activity } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

const ActivityLogs = () => {
  const navigate = useNavigate();

  const { data: logs, isLoading } = useQuery({
    queryKey: ['activity_logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activity_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);
      
      if (error) throw error;
      return data;
    },
    refetchInterval: 5000
  });

  const getSectionLabel = (section: string) => {
    const labels: Record<string, string> = {
      auth: 'المصادقة',
      orders: 'الأوردرات',
      products: 'المنتجات',
      categories: 'الأقسام',
      customers: 'العملاء',
      agents: 'المندوبين',
      agent_orders: 'طلبات المندوب',
      agent_payments: 'دفعات المندوب',
      governorates: 'المحافظات',
      statistics: 'الإحصائيات',
      invoices: 'الفواتير',
      user_management: 'إدارة المستخدمين',
      settings: 'الإعدادات',
    };
    return labels[section] || section;
  };

  if (isLoading) {
    return <div className="p-8 text-center">جاري التحميل...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-accent/20 py-8">
      <div className="container mx-auto px-4">
        <Button onClick={() => navigate('/admin')} variant="ghost" className="mb-4">
          <ArrowLeft className="ml-2 h-4 w-4" />
          رجوع
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              سجل النشاط
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-[70vh] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>التاريخ</TableHead>
                    <TableHead>المستخدم</TableHead>
                    <TableHead>القسم</TableHead>
                    <TableHead>الإجراء</TableHead>
                    <TableHead>التفاصيل</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs?.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-sm whitespace-nowrap">
                        {format(new Date(log.created_at), 'dd/MM/yyyy HH:mm', { locale: ar })}
                      </TableCell>
                      <TableCell className="font-medium">{log.username || '-'}</TableCell>
                      <TableCell>{getSectionLabel(log.section)}</TableCell>
                      <TableCell>{log.action}</TableCell>
                      <TableCell className="text-xs max-w-xs truncate text-muted-foreground">
                        {log.details ? JSON.stringify(log.details) : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ActivityLogs;
