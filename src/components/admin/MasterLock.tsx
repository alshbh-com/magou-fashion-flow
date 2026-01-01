import { useState } from 'react';
import { Lock, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { toast } from 'sonner';

const MasterLock = () => {
  const { unlock } = useAdminAuth();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      toast.error('أدخل كلمة المرور');
      return;
    }

    setLoading(true);
    const success = await unlock(password);
    setLoading(false);

    if (success) {
      toast.success('تم فتح القفل');
    } else {
      toast.error('كلمة مرور خاطئة');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-accent/20 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 p-4 rounded-full bg-primary/10 w-fit">
            <Lock className="h-12 w-12 text-primary" />
          </div>
          <CardTitle className="text-2xl">نظام الإدارة</CardTitle>
          <p className="text-muted-foreground mt-2">أدخل كلمة المرور الرئيسية للدخول</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUnlock} className="space-y-4">
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="كلمة المرور"
                className="pr-10 text-center text-lg tracking-widest"
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'جاري التحقق...' : 'فتح القفل'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default MasterLock;
