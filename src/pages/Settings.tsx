import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Lock } from "lucide-react";
import { checkAdminAuth, isAdminAuthenticated, setAdminAuth } from "@/lib/adminAuth";
import { toast } from "sonner";

const Settings = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    setIsAuthenticated(isAdminAuthenticated());
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (checkAdminAuth(password)) {
      setAdminAuth(true);
      setIsAuthenticated(true);
      toast.success("تم تسجيل الدخول بنجاح");
      navigate("/admin");
    } else {
      toast.error("كلمة السر غير صحيحة");
      setPassword("");
    }
  };

  const handleLogout = () => {
    setAdminAuth(false);
    setIsAuthenticated(false);
    toast.success("تم تسجيل الخروج");
    setPassword("");
  };

  if (isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-accent/20 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center">الإعدادات</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-center text-muted-foreground">
              تم تسجيل الدخول كمسؤول
            </p>
            <Button 
              onClick={() => navigate("/admin")}
              className="w-full"
            >
              الذهاب إلى لوحة التحكم
            </Button>
            <Button 
              onClick={handleLogout}
              variant="outline"
              className="w-full"
            >
              تسجيل الخروج
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-accent/20 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center">
              <Lock className="w-8 h-8 text-primary-foreground" />
            </div>
          </div>
          <CardTitle className="text-center">تسجيل الدخول للإعدادات</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <Input
                type="password"
                placeholder="أدخل كلمة السر"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="text-center"
              />
            </div>
            <Button type="submit" className="w-full">
              دخول
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Settings;
