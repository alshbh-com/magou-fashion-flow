import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Plus, Trash2, Pencil, ArrowLeft, Key, Eye, EyeOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAdminAuth } from '@/contexts/AdminAuthContext';

const PERMISSIONS = [
  { id: 'orders', label: 'الأوردرات' },
  { id: 'products', label: 'المنتجات' },
  { id: 'categories', label: 'الأقسام' },
  { id: 'customers', label: 'العملاء' },
  { id: 'agents', label: 'المندوبين' },
  { id: 'agent_orders', label: 'طلبات المندوب' },
  { id: 'agent_payments', label: 'دفعات المندوب' },
  { id: 'governorates', label: 'المحافظات' },
  { id: 'statistics', label: 'الإحصائيات' },
  { id: 'invoices', label: 'الفواتير' },
  { id: 'all_orders', label: 'كل الطلبات' },
  { id: 'settings', label: 'الإعدادات' },
  { id: 'reset_data', label: 'مسح البيانات' },
  { id: 'user_management', label: 'إدارة المستخدمين' },
];

const UserManagement = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { logActivity } = useAdminAuth();
  
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [permDialogOpen, setPermDialogOpen] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [showPasswords, setShowPasswords] = useState(false);
  
  const [newUser, setNewUser] = useState({ username: '', password: '' });
  const [passwordForm, setPasswordForm] = useState({ master: '', payment: '' });

  // Fetch users
  const { data: users, isLoading } = useQuery({
    queryKey: ['admin_users'],
    queryFn: async () => {
      const { data: usersData, error } = await supabase
        .from('admin_users')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;

      // Fetch permissions for each user
      const usersWithPermissions = await Promise.all(
        (usersData || []).map(async (user) => {
          const { data: perms } = await supabase
            .from('admin_user_permissions')
            .select('permission')
            .eq('user_id', user.id);
          return { ...user, permissions: perms?.map(p => p.permission) || [] };
        })
      );

      return usersWithPermissions;
    }
  });

  // Fetch system passwords
  const { data: systemPasswords } = useQuery({
    queryKey: ['system_passwords'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('system_passwords')
        .select('*');
      if (error) throw error;
      return data;
    }
  });

  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: async ({ username, password }: { username: string; password: string }) => {
      const { data, error } = await supabase
        .from('admin_users')
        .insert({ username, password })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin_users'] });
      toast.success('تم إنشاء المستخدم');
      logActivity('إنشاء مستخدم', 'user_management', { username: data.username });
      setNewUser({ username: '', password: '' });
      setSelectedUser(data);
      setSelectedPermissions([]);
      setCreateDialogOpen(false);
      setPermDialogOpen(true);
    },
    onError: (error: any) => {
      if (error.message?.includes('unique')) {
        toast.error('اسم المستخدم موجود مسبقاً');
      } else {
        toast.error('حدث خطأ أثناء الإنشاء');
      }
    }
  });

  type AdminPermission = "orders" | "products" | "categories" | "customers" | "agents" | "agent_orders" | "agent_payments" | "governorates" | "statistics" | "invoices" | "all_orders" | "settings" | "reset_data" | "user_management";

  // Save permissions mutation
  const savePermissionsMutation = useMutation({
    mutationFn: async ({ userId, permissions }: { userId: string; permissions: string[] }) => {
      // Delete existing permissions
      await supabase.from('admin_user_permissions').delete().eq('user_id', userId);
      
      // Insert new permissions
      if (permissions.length > 0) {
        const { error } = await supabase.from('admin_user_permissions').insert(
          permissions.map(p => ({ user_id: userId, permission: p as AdminPermission }))
        );
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_users'] });
      toast.success('تم حفظ الصلاحيات');
      logActivity('تعديل صلاحيات', 'user_management', { 
        userId: selectedUser?.id, 
        permissions: selectedPermissions 
      });
      setPermDialogOpen(false);
    },
    onError: () => {
      toast.error('حدث خطأ أثناء الحفظ');
    }
  });

  // Toggle user status mutation
  const toggleUserMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from('admin_users')
        .update({ is_active: isActive })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_users'] });
      toast.success('تم تحديث حالة المستخدم');
    }
  });

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('admin_users').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_users'] });
      toast.success('تم حذف المستخدم');
      logActivity('حذف مستخدم', 'user_management');
    }
  });

  // Update passwords mutation
  const updatePasswordsMutation = useMutation({
    mutationFn: async ({ master, payment }: { master: string; payment: string }) => {
      if (master) {
        const { error: masterError } = await supabase
          .from('system_passwords')
          .update({ password: master })
          .eq('id', 'master');
        if (masterError) throw masterError;
      }
      if (payment) {
        const { error: paymentError } = await supabase
          .from('system_passwords')
          .update({ password: payment })
          .eq('id', 'payment');
        if (paymentError) throw paymentError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system_passwords'] });
      toast.success('تم تحديث كلمات المرور');
      logActivity('تغيير كلمات مرور النظام', 'user_management');
      setPasswordDialogOpen(false);
      setPasswordForm({ master: '', payment: '' });
    },
    onError: () => {
      toast.error('حدث خطأ أثناء التحديث');
    }
  });

  const handleCreateUser = () => {
    if (!newUser.username || !newUser.password) {
      toast.error('أدخل اسم المستخدم وكلمة المرور');
      return;
    }
    createUserMutation.mutate(newUser);
  };

  const handleEditPermissions = (user: any) => {
    setSelectedUser(user);
    setSelectedPermissions(user.permissions || []);
    setPermDialogOpen(true);
  };

  const togglePermission = (permId: string) => {
    setSelectedPermissions(prev =>
      prev.includes(permId)
        ? prev.filter(p => p !== permId)
        : [...prev, permId]
    );
  };

  const selectAllPermissions = () => {
    setSelectedPermissions(PERMISSIONS.map(p => p.id));
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
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>إدارة المستخدمين</CardTitle>
            <div className="flex gap-2">
              <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <Key className="ml-2 h-4 w-4" />
                    كلمات المرور
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>تغيير كلمات مرور النظام</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>كلمة المرور الرئيسية (الحالية: {systemPasswords?.find(p => p.id === 'master')?.password})</Label>
                      <Input
                        value={passwordForm.master}
                        onChange={(e) => setPasswordForm(prev => ({ ...prev, master: e.target.value }))}
                        placeholder="اترك فارغ للإبقاء كما هي"
                      />
                    </div>
                    <div>
                      <Label>كلمة مرور الدفعات (الحالية: {systemPasswords?.find(p => p.id === 'payment')?.password})</Label>
                      <Input
                        value={passwordForm.payment}
                        onChange={(e) => setPasswordForm(prev => ({ ...prev, payment: e.target.value }))}
                        placeholder="اترك فارغ للإبقاء كما هي"
                      />
                    </div>
                    <Button 
                      onClick={() => updatePasswordsMutation.mutate(passwordForm)}
                      className="w-full"
                      disabled={!passwordForm.master && !passwordForm.payment}
                    >
                      حفظ التغييرات
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="ml-2 h-4 w-4" />
                    إنشاء مستخدم
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>إنشاء مستخدم جديد</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>اسم المستخدم</Label>
                      <Input
                        value={newUser.username}
                        onChange={(e) => setNewUser(prev => ({ ...prev, username: e.target.value }))}
                        placeholder="اسم المستخدم"
                      />
                    </div>
                    <div>
                      <Label>كلمة المرور</Label>
                      <div className="relative">
                        <Input
                          type={showPasswords ? 'text' : 'password'}
                          value={newUser.password}
                          onChange={(e) => setNewUser(prev => ({ ...prev, password: e.target.value }))}
                          placeholder="كلمة المرور"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPasswords(!showPasswords)}
                          className="absolute left-3 top-1/2 -translate-y-1/2"
                        >
                          {showPasswords ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    <Button onClick={handleCreateUser} className="w-full">
                      إنشاء وتحديد الصلاحيات
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>اسم المستخدم</TableHead>
                  <TableHead>كلمة المرور</TableHead>
                  <TableHead>الصلاحيات</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users?.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.username}</TableCell>
                    <TableCell className="font-mono text-sm">{user.password}</TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {user.permissions?.length || 0} صلاحية
                      </span>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={user.is_active}
                        onCheckedChange={(checked) => toggleUserMutation.mutate({ id: user.id, isActive: checked })}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button size="icon" variant="ghost" onClick={() => handleEditPermissions(user)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="icon" variant="ghost" className="text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>حذف المستخدم</AlertDialogTitle>
                              <AlertDialogDescription>
                                هل أنت متأكد من حذف المستخدم {user.username}؟
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>إلغاء</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteUserMutation.mutate(user.id)}>
                                حذف
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Permissions Dialog */}
        <Dialog open={permDialogOpen} onOpenChange={setPermDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>صلاحيات {selectedUser?.username}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Button variant="outline" size="sm" onClick={selectAllPermissions}>
                تحديد الكل
              </Button>
              <div className="grid grid-cols-2 gap-3 max-h-64 overflow-y-auto">
                {PERMISSIONS.map((perm) => (
                  <label key={perm.id} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={selectedPermissions.includes(perm.id)}
                      onCheckedChange={() => togglePermission(perm.id)}
                    />
                    <span className="text-sm">{perm.label}</span>
                  </label>
                ))}
              </div>
              <Button 
                onClick={() => savePermissionsMutation.mutate({ userId: selectedUser?.id, permissions: selectedPermissions })}
                className="w-full"
              >
                حفظ الصلاحيات
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default UserManagement;
