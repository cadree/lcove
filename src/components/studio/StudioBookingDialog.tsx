import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { DollarSign, Coins, MapPin, Clock } from 'lucide-react';
import { StoreItem } from '@/hooks/useStore';
import { useCreateBookingRequest, useItemBookings } from '@/hooks/useStudioBookings';
import { format, isSameDay } from 'date-fns';

interface StudioBookingDialogProps {
  item: StoreItem;
  open: boolean;
  onClose: () => void;
}

export const StudioBookingDialog: React.FC<StudioBookingDialogProps> = ({ item, open, onClose }) => {
  const createBooking = useCreateBookingRequest();
  const { data: existingBookings = [] } = useItemBookings(item.id);
  
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [startTime, setStartTime] = useState('10:00');
  const [endTime, setEndTime] = useState('14:00');
  const [paymentType, setPaymentType] = useState<'cash' | 'credits'>('cash');
  const [message, setMessage] = useState('');

  const bookedDates = existingBookings.map(b => new Date(b.requested_date));
  
  const isDateBooked = (date: Date) => {
    return bookedDates.some(booked => isSameDay(booked, date));
  };

  const calculateTotal = () => {
    if (!selectedDate) return { price: 0, credits: 0 };
    const start = parseInt(startTime.split(':')[0]);
    const end = parseInt(endTime.split(':')[0]);
    const hours = Math.max(end - start, 1);
    return {
      price: item.price * hours,
      credits: (item.credits_price || 0) * hours,
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDate) return;

    const totals = calculateTotal();
    const start = parseInt(startTime.split(':')[0]);
    const end = parseInt(endTime.split(':')[0]);
    const hours = Math.max(end - start, 1);

    await createBooking.mutateAsync({
      item_id: item.id,
      owner_id: item.store_id, // This should be the store owner's ID
      requested_date: format(selectedDate, 'yyyy-MM-dd'),
      start_time: startTime,
      end_time: endTime,
      duration_hours: hours,
      total_price: paymentType === 'cash' ? totals.price : 0,
      credits_spent: paymentType === 'credits' ? totals.credits : 0,
      payment_type: paymentType,
      message,
    });

    onClose();
  };

  const totals = calculateTotal();

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Request Booking</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Studio Info */}
          <div className="flex gap-4 p-3 bg-muted rounded-lg">
            {item.images?.[0] && (
              <img src={item.images[0]} alt={item.title} className="w-20 h-20 object-cover rounded" />
            )}
            <div>
              <h3 className="font-semibold">{item.title}</h3>
              {item.location && (
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {item.location}
                </p>
              )}
              <div className="flex gap-2 mt-1">
                <Badge variant="outline">${item.price}/hr</Badge>
                {item.credits_price > 0 && (
                  <Badge variant="outline">{item.credits_price} LC/hr</Badge>
                )}
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Calendar */}
            <div className="space-y-2">
              <Label>Select Date</Label>
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                disabled={(date) => date < new Date() || isDateBooked(date)}
                className="rounded-md border mx-auto"
              />
            </div>

            {/* Time Selection */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Time</Label>
                <Input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>End Time</Label>
                <Input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>
            </div>

            {/* Payment Type */}
            <div className="space-y-2">
              <Label>Payment Method</Label>
              <RadioGroup
                value={paymentType}
                onValueChange={(v) => setPaymentType(v as 'cash' | 'credits')}
                className="flex gap-4"
              >
                <Label
                  htmlFor="cash"
                  className={`flex-1 flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${
                    paymentType === 'cash' ? 'border-primary bg-primary/10' : 'border-border'
                  }`}
                >
                  <RadioGroupItem value="cash" id="cash" />
                  <DollarSign className="h-4 w-4" />
                  <div>
                    <p className="font-medium">Cash</p>
                    <p className="text-sm text-muted-foreground">${totals.price}</p>
                  </div>
                </Label>
                
                {item.credits_price > 0 && (
                  <Label
                    htmlFor="credits"
                    className={`flex-1 flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${
                      paymentType === 'credits' ? 'border-primary bg-primary/10' : 'border-border'
                    }`}
                  >
                    <RadioGroupItem value="credits" id="credits" />
                    <Coins className="h-4 w-4" />
                    <div>
                      <p className="font-medium">LC Credits</p>
                      <p className="text-sm text-muted-foreground">{totals.credits} LC</p>
                    </div>
                  </Label>
                )}
              </RadioGroup>
            </div>

            {/* Message */}
            <div className="space-y-2">
              <Label>Message to Owner</Label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Tell them about your project, what you'll be recording, etc."
                rows={3}
              />
            </div>

            {/* Summary */}
            {selectedDate && (
              <div className="p-3 bg-primary/10 rounded-lg space-y-1">
                <div className="flex justify-between">
                  <span>Date</span>
                  <span className="font-medium">{format(selectedDate, 'MMM d, yyyy')}</span>
                </div>
                <div className="flex justify-between">
                  <span>Time</span>
                  <span className="font-medium">{startTime} - {endTime}</span>
                </div>
                <div className="flex justify-between border-t pt-1 mt-1">
                  <span className="font-semibold">Total</span>
                  <span className="font-semibold">
                    {paymentType === 'cash' ? `$${totals.price}` : `${totals.credits} LC`}
                  </span>
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" onClick={onClose} className="flex-1">
                Cancel
              </Button>
              <Button 
                type="submit" 
                className="flex-1" 
                disabled={!selectedDate || createBooking.isPending}
              >
                Send Request
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
};
