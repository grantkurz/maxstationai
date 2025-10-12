import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Database } from "@/types/supabase";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Calendar,
  MapPin,
  Clock,
  Plus,
  ArrowRight,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function EventsPage() {
  const supabase = createServerComponentClient<Database>({ cookies });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: events } = await supabase
    .from("events")
    .select("*")
    .eq("user_id", user.id)
    .order("date", { ascending: true });

  // Count speakers for each event
  const eventsWithSpeakerCount = await Promise.all(
    (events || []).map(async (event) => {
      const { count } = await supabase
        .from("speakers")
        .select("*", { count: "exact", head: true })
        .eq("event_id", event.id);

      return {
        ...event,
        speakerCount: count || 0,
      };
    })
  );

  const upcomingEvents = eventsWithSpeakerCount.filter(
    (event) => new Date(event.date) >= new Date()
  );
  const pastEvents = eventsWithSpeakerCount.filter(
    (event) => new Date(event.date) < new Date()
  );

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Animated background - matching landing page aesthetic */}
      <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 via-purple-500/5 to-fuchsia-500/5 animate-gradient-shift" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-violet-500/10 via-transparent to-transparent" />
      <div className="absolute inset-0 bg-grid-pattern opacity-[0.02]" />

      {/* Floating orbs decoration */}
      <div className="absolute top-20 right-0 w-96 h-96 bg-gradient-to-br from-violet-500/10 to-purple-500/10 rounded-full blur-3xl animate-float pointer-events-none" />
      <div className="absolute bottom-20 left-0 w-96 h-96 bg-gradient-to-br from-fuchsia-500/10 to-pink-500/10 rounded-full blur-3xl animate-float-delayed pointer-events-none" />

      <div className="relative container mx-auto py-8 px-4 sm:py-12 lg:py-16">
        <div className="max-w-7xl mx-auto">
          {/* Header Section */}
          <header className="mb-8 sm:mb-12 lg:mb-16">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
              <div className="space-y-3 sm:space-y-4">
                {/* Badge */}
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 backdrop-blur-sm">
                  <Zap className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
                  <span className="text-xs font-medium text-violet-700 dark:text-violet-300">
                    Event Dashboard
                  </span>
                </div>

                <div>
                  <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight">
                    Your Events
                  </h1>
                  <p className="text-base sm:text-lg lg:text-xl text-muted-foreground mt-2 sm:mt-3 max-w-2xl">
                    Manage events, speakers, and automated campaigns all in one place
                  </p>
                </div>

                {/* Stats row - mobile optimized */}
                {events && events.length > 0 && (
                  <div className="flex flex-wrap items-center gap-4 sm:gap-6 pt-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center">
                        <Calendar className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Total Events</p>
                        <p className="text-lg font-bold">{events.length}</p>
                      </div>
                    </div>
                    {upcomingEvents.length > 0 && (
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-fuchsia-500 to-pink-500 flex items-center justify-center">
                          <Sparkles className="w-4 h-4 text-white" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Upcoming</p>
                          <p className="text-lg font-bold">{upcomingEvents.length}</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* CTA Button */}
              <Link href="/events/new" className="w-full sm:w-auto">
                <Button
                  size="lg"
                  className="w-full sm:w-auto gap-2 shadow-lg shadow-violet-500/25 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 transition-all duration-300 hover:shadow-xl hover:shadow-violet-500/30 hover:scale-[1.02]"
                >
                  <Plus className="w-5 h-5" />
                  Create Event
                </Button>
              </Link>
            </div>
          </header>

          {/* Empty State */}
          {!events || events.length === 0 ? (
            <div className="max-w-2xl mx-auto animate-in fade-in duration-500">
              <Card className="border-2 border-dashed border-violet-200 dark:border-violet-800 bg-card/50 backdrop-blur-sm overflow-hidden relative group hover:border-violet-300 dark:hover:border-violet-700 transition-all duration-300">
                {/* Gradient overlay on hover */}
                <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-fuchsia-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                <CardHeader className="text-center space-y-6 py-12 sm:py-16 relative">
                  {/* Icon with animated gradient ring */}
                  <div className="mx-auto relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-2xl blur-xl opacity-50 group-hover:opacity-75 transition-opacity duration-300" />
                    <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-br from-violet-600 via-purple-600 to-fuchsia-600 flex items-center justify-center shadow-xl">
                      <Calendar className="w-10 h-10 sm:w-12 sm:h-12 text-white" />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <CardTitle className="text-3xl sm:text-4xl font-bold">
                      No events yet
                    </CardTitle>
                    <CardDescription className="text-base sm:text-lg max-w-md mx-auto">
                      Create your first event and start building your community with AI-powered automation
                    </CardDescription>
                  </div>

                  {/* Feature hints */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6 max-w-xl mx-auto">
                    <div className="flex flex-col items-center gap-2 text-center">
                      <div className="w-10 h-10 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                        <Users className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                      </div>
                      <p className="text-xs text-muted-foreground">Manage Speakers</p>
                    </div>
                    <div className="flex flex-col items-center gap-2 text-center">
                      <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                        <Sparkles className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                      </div>
                      <p className="text-xs text-muted-foreground">AI Content</p>
                    </div>
                    <div className="flex flex-col items-center gap-2 text-center">
                      <div className="w-10 h-10 rounded-lg bg-fuchsia-100 dark:bg-fuchsia-900/30 flex items-center justify-center">
                        <Zap className="w-5 h-5 text-fuchsia-600 dark:text-fuchsia-400" />
                      </div>
                      <p className="text-xs text-muted-foreground">Auto Campaigns</p>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="text-center pb-12 sm:pb-16 relative">
                  <Link href="/events/new">
                    <Button
                      size="lg"
                      className="gap-2 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02] text-base px-8"
                    >
                      <Plus className="w-5 h-5" />
                      Create Your First Event
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="space-y-12 lg:space-y-16 max-w-7xl mx-auto">
              {/* Upcoming Events */}
              {upcomingEvents.length > 0 && (
                <section className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="absolute inset-0 bg-gradient-to-br from-violet-500 to-purple-500 rounded-xl blur-lg opacity-50" />
                      <div className="relative w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center shadow-lg">
                        <Sparkles className="w-6 h-6 text-white" />
                      </div>
                    </div>
                    <div>
                      <h2 className="text-2xl sm:text-3xl font-bold">Upcoming Events</h2>
                      <p className="text-sm sm:text-base text-muted-foreground">
                        {upcomingEvents.length} {upcomingEvents.length === 1 ? 'event' : 'events'} scheduled
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {upcomingEvents.map((event, index) => (
                      <div
                        key={event.id}
                        className="animate-in fade-in slide-in-from-bottom-8 duration-500"
                        style={{ animationDelay: `${index * 100}ms` }}
                      >
                        <EventCard event={event} />
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Past Events */}
              {pastEvents.length > 0 && (
                <section className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: '200ms' }}>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-muted/50 backdrop-blur-sm flex items-center justify-center border border-border">
                      <Calendar className="w-6 h-6 text-muted-foreground" />
                    </div>
                    <div>
                      <h2 className="text-2xl sm:text-3xl font-bold">Past Events</h2>
                      <p className="text-sm sm:text-base text-muted-foreground">
                        {pastEvents.length} completed {pastEvents.length === 1 ? 'event' : 'events'}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {pastEvents.map((event, index) => (
                      <div
                        key={event.id}
                        className="animate-in fade-in slide-in-from-bottom-8 duration-500"
                        style={{ animationDelay: `${index * 100}ms` }}
                      >
                        <EventCard event={event} isPast />
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Event Card Component
function EventCard({
  event,
  isPast = false
}: {
  event: Database["public"]["Tables"]["events"]["Row"] & { speakerCount: number };
  isPast?: boolean;
}) {
  const eventDate = new Date(event.date);
  const isUpcoming = eventDate >= new Date();
  const daysUntil = Math.ceil((eventDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));

  return (
    <Link href={`/events/${event.id}`} className="group block h-full">
      <Card className={`
        h-full transition-all duration-300 relative overflow-hidden
        hover:shadow-2xl hover:-translate-y-2
        ${isUpcoming
          ? 'border-l-4 border-l-violet-500 hover:shadow-violet-500/20 bg-card/80 backdrop-blur-sm'
          : 'opacity-70 hover:opacity-100 bg-card/50 backdrop-blur-sm'
        }
      `}>
        {/* Gradient overlay on hover */}
        <div className={`
          absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300
          ${isUpcoming
            ? 'bg-gradient-to-br from-violet-500/5 via-purple-500/5 to-fuchsia-500/5'
            : 'bg-gradient-to-br from-muted/20 to-muted/10'
          }
        `} />

        <CardHeader className="space-y-4 relative">
          {/* Header with badge */}
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2 flex-1 min-w-0">
              <CardTitle className="text-xl sm:text-2xl line-clamp-2 group-hover:text-transparent group-hover:bg-gradient-to-r group-hover:from-violet-600 group-hover:to-fuchsia-600 group-hover:bg-clip-text transition-all duration-300">
                {event.title}
              </CardTitle>
              <div className="flex items-center gap-2">
                <div className="px-2.5 py-1 rounded-md bg-muted/80 backdrop-blur-sm">
                  <CardDescription className="text-xs font-medium">
                    {event.type}
                  </CardDescription>
                </div>
              </div>
            </div>

            {/* Days until badge */}
            {isUpcoming && daysUntil <= 14 && daysUntil >= 0 && (
              <div className="relative shrink-0">
                {daysUntil <= 7 && (
                  <div className="absolute inset-0 bg-violet-500 rounded-full blur-md opacity-50 animate-pulse" />
                )}
                <div className={`
                  relative px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap
                  ${daysUntil === 0
                    ? 'bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-lg'
                    : daysUntil <= 7
                      ? 'bg-violet-500/15 text-violet-700 dark:text-violet-300 border border-violet-500/30'
                      : 'bg-muted text-muted-foreground'
                  }
                `}>
                  {daysUntil === 0 ? 'Today!' : `${daysUntil}d`}
                </div>
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-5 relative">
          {/* Event Details */}
          <div className="space-y-3.5">
            {/* Date */}
            <div className="flex items-center gap-3 text-sm group/item hover:text-foreground transition-colors">
              <div className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center flex-shrink-0 group-hover/item:bg-violet-500/10 transition-colors">
                <Calendar className="w-4 h-4 text-muted-foreground group-hover/item:text-violet-600 dark:group-hover/item:text-violet-400 transition-colors" />
              </div>
              <span className="font-medium text-foreground/90">
                {(() => {
                  // For date-only values, parse directly to avoid UTC conversion
                  const [year, month, day] = event.date.split('-').map(Number);
                  const localDate = new Date(year, month - 1, day);
                  return localDate.toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  });
                })()}
              </span>
            </div>

            {/* Time */}
            <div className="flex items-center gap-3 text-sm group/item hover:text-foreground transition-colors">
              <div className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center flex-shrink-0 group-hover/item:bg-purple-500/10 transition-colors">
                <Clock className="w-4 h-4 text-muted-foreground group-hover/item:text-purple-600 dark:group-hover/item:text-purple-400 transition-colors" />
              </div>
              <span className="text-muted-foreground">
                {event.start_time} - {event.end_time}
                {event.timezone && ` ${event.timezone}`}
              </span>
            </div>

            {/* Location */}
            <div className="flex items-center gap-3 text-sm group/item hover:text-foreground transition-colors">
              <div className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center flex-shrink-0 group-hover/item:bg-fuchsia-500/10 transition-colors">
                <MapPin className="w-4 h-4 text-muted-foreground group-hover/item:text-fuchsia-600 dark:group-hover/item:text-fuchsia-400 transition-colors" />
              </div>
              <span className="line-clamp-1 text-muted-foreground">{event.location}</span>
            </div>

            {/* Speaker Count */}
            <div className="flex items-center gap-3 text-sm group/item hover:text-foreground transition-colors">
              <div className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center flex-shrink-0 group-hover/item:bg-cyan-500/10 transition-colors">
                <Users className="w-4 h-4 text-muted-foreground group-hover/item:text-cyan-600 dark:group-hover/item:text-cyan-400 transition-colors" />
              </div>
              <span className="text-muted-foreground">
                {event.speakerCount} {event.speakerCount === 1 ? 'speaker' : 'speakers'}
              </span>
            </div>
          </div>

          {/* Description Preview */}
          {event.description && (
            <div className="pt-4 border-t border-border/50">
              <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                {event.description}
              </p>
            </div>
          )}

          {/* View Details Link */}
          <div className="flex items-center gap-2 text-sm font-semibold pt-2">
            <span className="bg-gradient-to-r from-violet-600 to-fuchsia-600 bg-clip-text text-transparent">
              View Details
            </span>
            <ArrowRight className="w-4 h-4 text-violet-600 dark:text-violet-400 group-hover:translate-x-2 transition-transform duration-300" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
