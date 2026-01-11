'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Bell, BellOff, Check, X } from 'lucide-react';
import { notificationService } from '@/lib/notifications';
import { toast } from 'sonner';

export function NotificationSettings() {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    setPermission(notificationService.getPermission());
    setEnabled(notificationService.isEnabled());
  }, []);

  const handleRequestPermission = async () => {
    const result = await notificationService.requestPermission();
    setPermission(result);
    setEnabled(notificationService.isEnabled());

    if (result === 'granted') {
      toast.success('Notifications enabled');
      notificationService.show('Notifications Enabled', {
        body: 'You will now receive notifications from Jules UI',
      });
    } else if (result === 'denied') {
      toast.error('Notification permission denied. Enable in browser settings.');
    }
  };

  const handleTestNotification = () => {
    notificationService.show('Test Notification', {
      body: 'This is a test notification from Jules UI',
    });
  };

  const getPermissionBadge = () => {
    switch (permission) {
      case 'granted':
        return (
          <span className="flex items-center gap-1 text-green-400 text-sm">
            <Check className="h-4 w-4" /> Enabled
          </span>
        );
      case 'denied':
        return (
          <span className="flex items-center gap-1 text-red-400 text-sm">
            <X className="h-4 w-4" /> Blocked
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1 text-yellow-400 text-sm">
            <Bell className="h-4 w-4" /> Not set
          </span>
        );
    }
  };

  return (
    <Card className="border-white/10 bg-zinc-950">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          {enabled ? <Bell className="h-5 w-5" /> : <BellOff className="h-5 w-5" />}
          Browser Notifications
        </CardTitle>
        <CardDescription className="text-white/60">
          Get notified when sessions complete or need approval
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-white/80">Permission Status</Label>
          {getPermissionBadge()}
        </div>

        {permission === 'default' && (
          <Button
            onClick={handleRequestPermission}
            className="w-full bg-purple-600 hover:bg-purple-500"
          >
            <Bell className="h-4 w-4 mr-2" />
            Enable Notifications
          </Button>
        )}

        {permission === 'denied' && (
          <p className="text-sm text-white/40">
            Notifications are blocked. Enable them in your browser settings for this site.
          </p>
        )}

        {permission === 'granted' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-white/80">Session Complete</Label>
                <p className="text-xs text-white/40">Notify when a session finishes</p>
              </div>
              <Switch defaultChecked />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label className="text-white/80">Approval Needed</Label>
                <p className="text-xs text-white/40">Notify when a session needs approval</p>
              </div>
              <Switch defaultChecked />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label className="text-white/80">Session Errors</Label>
                <p className="text-xs text-white/40">Notify when a session encounters an error</p>
              </div>
              <Switch defaultChecked />
            </div>

            <Button
              variant="outline"
              onClick={handleTestNotification}
              className="w-full border-white/10 text-white/70 hover:text-white"
            >
              Send Test Notification
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
