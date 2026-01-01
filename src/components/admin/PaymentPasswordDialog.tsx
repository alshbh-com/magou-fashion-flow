import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Eye, EyeOff } from 'lucide-react';

interface PaymentPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const PaymentPasswordDialog = ({ open, onOpenChange, onSuccess }: PaymentPasswordDialogProps) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      toast.error('أدخل كلمة المرور');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('system_passwords')
        .select('password')
        .eq('id', 'payment')
        .single();

      if (error) throw error;

      if (data.password === password) {
        toast.success('تم التحقق');
        onSuccess();
        onOpenChange(false);
        setPassword('');
      } else {
        toast.error('كلمة مرور خاطئة');
      }
    } catch (error) {
      toast.error('حدث خطأ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>تأكيد كلمة مرور الدفعات</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="كلمة مرور الدفعات"
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute left-3 top-1/2 -translate-y-1/2"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'جاري التحقق...' : 'تأكيد'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default PaymentPasswordDialog;
