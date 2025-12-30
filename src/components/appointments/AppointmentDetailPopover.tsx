import { useState } from "react";
import { format } from "date-fns";
import { Calendar, Clock, MapPin, Trash2, Edit, CheckCircle, XCircle, User } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Appointment, useUpdateAppointment, useDeleteAppointment } from "@/hooks/useAppointments";
import { EditAppointmentModal } from "./EditAppointmentModal";

interface AppointmentDetailPopoverProps {
  appointment: Appointment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AppointmentDetailPopover({
  appointment,
  open,
  onOpenChange,
}: AppointmentDetailPopoverProps) {
  const [editModalOpen, setEditModalOpen] = useState(false);
  const updateAppointment = useUpdateAppointment();
  const deleteAppointment = useDeleteAppointment();

  if (!appointment) return null;

  const handleStatusChange = async (status: 'confirmed' | 'canceled' | 'completed') => {
    await updateAppointment.mutateAsync({ id: appointment.id, status });
  };

  const handleDelete = async () => {
    await deleteAppointment.mutateAsync(appointment.id);
    onOpenChange(false);
  };

  const startDate = new Date(appointment.starts_at);
  const endDate = new Date(appointment.ends_at);
  const durationMinutes = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60));

  const getStatusBadge = () => {
    switch (appointment.status) {
      case 'confirmed':
        return <Badge className="bg-primary/20 text-primary border-primary/30">Confirmed</Badge>;
      case 'canceled':
        return <Badge variant="destructive">Canceled</Badge>;
      case 'completed':
        return <Badge className="bg-accent/20 text-accent-foreground border-accent/30">Completed</Badge>;
      default:
        return null;
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <div className="flex items-start justify-between gap-4">
              <DialogTitle className="text-xl">{appointment.title}</DialogTitle>
              {getStatusBadge()}
            </div>
          </DialogHeader>

          <div className="space-y-4">
            {/* Date & Time */}
            <div className="flex items-center gap-3 text-foreground">
              <Calendar className="w-5 h-5 text-muted-foreground" />
              <div>
                <div className="font-medium">{format(startDate, 'EEEE, MMMM d, yyyy')}</div>
                <div className="text-sm text-muted-foreground">
                  {format(startDate, 'h:mm a')} – {format(endDate, 'h:mm a')} ({durationMinutes} min)
                </div>
              </div>
            </div>

            {/* Location */}
            {appointment.location && (
              <div className="flex items-center gap-3 text-foreground">
                <MapPin className="w-5 h-5 text-muted-foreground" />
                <span>{appointment.location}</span>
              </div>
            )}

            {/* Contact */}
            {appointment.contact && (
              <div className="flex items-center gap-3 text-foreground">
                <User className="w-5 h-5 text-muted-foreground" />
                <div>
                  <div className="font-medium">{appointment.contact.full_name}</div>
                  {appointment.contact.email && (
                    <div className="text-sm text-muted-foreground">{appointment.contact.email}</div>
                  )}
                </div>
              </div>
            )}

            {/* Team */}
            {appointment.team && (
              <div className="flex items-center gap-3 text-foreground">
                <Clock className="w-5 h-5 text-muted-foreground" />
                <span>Team: {appointment.team.name}</span>
              </div>
            )}

            {/* Description */}
            {appointment.description && (
              <>
                <Separator />
                <p className="text-sm text-muted-foreground">{appointment.description}</p>
              </>
            )}

            <Separator />

            {/* Quick Actions */}
            <div className="flex flex-wrap gap-2">
              {appointment.status !== 'completed' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleStatusChange('completed')}
                  disabled={updateAppointment.isPending}
                >
                  <CheckCircle className="w-4 h-4 mr-1" />
                  Complete
                </Button>
              )}
              {appointment.status !== 'canceled' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleStatusChange('canceled')}
                  disabled={updateAppointment.isPending}
                >
                  <XCircle className="w-4 h-4 mr-1" />
                  Cancel
                </Button>
              )}
              {appointment.status === 'canceled' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleStatusChange('confirmed')}
                  disabled={updateAppointment.isPending}
                >
                  <CheckCircle className="w-4 h-4 mr-1" />
                  Restore
                </Button>
              )}
            </div>

            {/* Main Actions */}
            <div className="flex justify-between pt-2">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm">
                    <Trash2 className="w-4 h-4 mr-1" />
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete appointment?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete the appointment.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditModalOpen(true)}
              >
                <Edit className="w-4 h-4 mr-1" />
                Edit
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <EditAppointmentModal
        appointment={appointment}
        open={editModalOpen}
        onOpenChange={(open) => {
          setEditModalOpen(open);
          if (!open) onOpenChange(false);
        }}
      />
    </>
  );
}
