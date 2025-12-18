import React, { useState } from 'react';
import { Calendar, MapPin, Clock, Plus, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useGroupItinerary, useCreateItinerary, useAddItineraryItem, GroupItinerary as ItineraryType } from '@/hooks/useGroupChat';
import { format, differenceInDays, addDays, parseISO } from 'date-fns';

interface GroupItineraryProps {
  conversationId: string;
  isOwnerOrMod: boolean;
}

export const GroupItinerary: React.FC<GroupItineraryProps> = ({ 
  conversationId, 
  isOwnerOrMod 
}) => {
  const [createItineraryOpen, setCreateItineraryOpen] = useState(false);
  const [addItemOpen, setAddItemOpen] = useState<{ dayNumber: number } | null>(null);
  const [newItinerary, setNewItinerary] = useState({
    title: '',
    start_date: '',
    end_date: '',
  });
  const [newItem, setNewItem] = useState({
    title: '',
    description: '',
    location: '',
    start_time: '',
    end_time: '',
  });

  const { data: itinerary, isLoading } = useGroupItinerary(conversationId);
  const createItinerary = useCreateItinerary();
  const addItem = useAddItineraryItem();

  const handleCreateItinerary = () => {
    createItinerary.mutate({
      conversation_id: conversationId,
      ...newItinerary,
    });
    setCreateItineraryOpen(false);
    setNewItinerary({ title: '', start_date: '', end_date: '' });
  };

  const handleAddItem = () => {
    if (!itinerary || !addItemOpen) return;
    
    addItem.mutate({
      itinerary_id: itinerary.id,
      day_number: addItemOpen.dayNumber,
      ...newItem,
      conversationId,
    });
    setAddItemOpen(null);
    setNewItem({ title: '', description: '', location: '', start_time: '', end_time: '' });
  };

  const getDays = (itinerary: ItineraryType) => {
    const start = parseISO(itinerary.start_date);
    const end = parseISO(itinerary.end_date);
    const numDays = differenceInDays(end, start) + 1;
    
    return Array.from({ length: numDays }, (_, i) => ({
      dayNumber: i + 1,
      date: addDays(start, i),
      items: itinerary.items?.filter(item => item.day_number === i + 1) || [],
    }));
  };

  if (isLoading) {
    return <Skeleton className="h-40" />;
  }

  if (!itinerary) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Calendar className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground mb-4">No itinerary set up yet</p>
          {isOwnerOrMod && (
            <Button onClick={() => setCreateItineraryOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Itinerary
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  const days = getDays(itinerary);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {itinerary.title}
          </h3>
          <p className="text-sm text-muted-foreground">
            {format(parseISO(itinerary.start_date), 'MMM d')} - {format(parseISO(itinerary.end_date), 'MMM d, yyyy')}
          </p>
        </div>
        <Badge variant="secondary">{days.length} days</Badge>
      </div>

      {/* Days */}
      <Accordion type="single" collapsible defaultValue="day-1">
        {days.map(day => (
          <AccordionItem key={day.dayNumber} value={`day-${day.dayNumber}`}>
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3">
                <div className="bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold">
                  {day.dayNumber}
                </div>
                <div className="text-left">
                  <div className="font-medium">Day {day.dayNumber}</div>
                  <div className="text-sm text-muted-foreground">
                    {format(day.date, 'EEEE, MMMM d')}
                  </div>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="pl-11 space-y-3">
                {day.items.length === 0 ? (
                  <div className="py-4 text-center text-muted-foreground">
                    No activities planned
                  </div>
                ) : (
                  day.items
                    .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''))
                    .map(item => (
                      <Card key={item.id} className="bg-muted/50">
                        <CardContent className="p-3">
                          <div className="flex items-start justify-between">
                            <div>
                              <h4 className="font-medium">{item.title}</h4>
                              {item.description && (
                                <p className="text-sm text-muted-foreground mt-1">
                                  {item.description}
                                </p>
                              )}
                              <div className="flex flex-wrap gap-2 mt-2">
                                {item.start_time && (
                                  <Badge variant="outline" className="gap-1">
                                    <Clock className="h-3 w-3" />
                                    {item.start_time}
                                    {item.end_time && ` - ${item.end_time}`}
                                  </Badge>
                                )}
                                {item.location && (
                                  <Badge variant="outline" className="gap-1">
                                    <MapPin className="h-3 w-3" />
                                    {item.location}
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </CardContent>
                      </Card>
                    ))
                )}
                {isOwnerOrMod && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="w-full"
                    onClick={() => setAddItemOpen({ dayNumber: day.dayNumber })}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Activity
                  </Button>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      {/* Create Itinerary Dialog */}
      <Dialog open={createItineraryOpen} onOpenChange={setCreateItineraryOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Itinerary</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Title</Label>
              <Input
                value={newItinerary.title}
                onChange={(e) => setNewItinerary({ ...newItinerary, title: e.target.value })}
                placeholder="e.g., LA Trip 2024"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={newItinerary.start_date}
                  onChange={(e) => setNewItinerary({ ...newItinerary, start_date: e.target.value })}
                />
              </div>
              <div>
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={newItinerary.end_date}
                  onChange={(e) => setNewItinerary({ ...newItinerary, end_date: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateItineraryOpen(false)}>Cancel</Button>
            <Button 
              onClick={handleCreateItinerary} 
              disabled={!newItinerary.title || !newItinerary.start_date || !newItinerary.end_date}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Item Dialog */}
      <Dialog open={!!addItemOpen} onOpenChange={() => setAddItemOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Activity - Day {addItemOpen?.dayNumber}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Activity</Label>
              <Input
                value={newItem.title}
                onChange={(e) => setNewItem({ ...newItem, title: e.target.value })}
                placeholder="e.g., Beach day"
              />
            </div>
            <div>
              <Label>Description (optional)</Label>
              <Textarea
                value={newItem.description}
                onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                placeholder="Details about this activity..."
              />
            </div>
            <div>
              <Label>Location (optional)</Label>
              <Input
                value={newItem.location}
                onChange={(e) => setNewItem({ ...newItem, location: e.target.value })}
                placeholder="e.g., Santa Monica Beach"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Start Time</Label>
                <Input
                  type="time"
                  value={newItem.start_time}
                  onChange={(e) => setNewItem({ ...newItem, start_time: e.target.value })}
                />
              </div>
              <div>
                <Label>End Time</Label>
                <Input
                  type="time"
                  value={newItem.end_time}
                  onChange={(e) => setNewItem({ ...newItem, end_time: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddItemOpen(null)}>Cancel</Button>
            <Button onClick={handleAddItem} disabled={!newItem.title}>
              Add Activity
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
