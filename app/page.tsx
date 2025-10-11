import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight, Users, Zap, TrendingUp, Sparkles, Calendar, MessageSquare } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function Index() {
  const supabase = createServerComponentClient({ cookies })

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Redirect authenticated users to events page
  if (user) {
    redirect("/events")
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Animated background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-violet-500/10 via-purple-500/10 to-fuchsia-500/10 animate-gradient-shift" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-cyan-500/20 via-transparent to-transparent" />

      {/* Grid pattern overlay */}
      <div className="absolute inset-0 bg-grid-pattern opacity-[0.02]" />

      {/* Hero Section */}
      <section className="relative container mx-auto px-4 pt-24 pb-32 lg:pt-32 lg:pb-40">
        <div className="max-w-5xl mx-auto text-center space-y-8">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 backdrop-blur-sm">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">AI-Powered Event Marketing</span>
          </div>

          {/* Main headline */}
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight">
            Build Thriving
            <span className="block bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 bg-clip-text text-transparent animate-gradient-x">
              Communities at Scale
            </span>
          </h1>

          {/* Subheadline */}
          <p className="text-xl sm:text-2xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            Transform your events into powerful community-building engines.
            Automate speaker promotion, generate engaging content, and amplify your reach across social platforms.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link href="/login">
              <Button size="lg" className="text-lg px-8 h-14 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 shadow-lg shadow-violet-500/50">
                Get Started Free
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
            <Link href="#features">
              <Button size="lg" variant="outline" className="text-lg px-8 h-14 border-2">
                See How It Works
              </Button>
            </Link>
          </div>

          {/* Social proof */}
          <div className="pt-8 flex items-center justify-center gap-8 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="flex -space-x-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-500 border-2 border-background" />
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-fuchsia-500 border-2 border-background" />
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-fuchsia-500 to-pink-500 border-2 border-background" />
              </div>
              <span>Trusted by event organizers worldwide</span>
            </div>
          </div>
        </div>

        {/* Floating cards decoration */}
        <div className="absolute top-1/4 right-0 w-72 h-72 bg-gradient-to-br from-violet-500/20 to-purple-500/20 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-1/4 left-0 w-72 h-72 bg-gradient-to-br from-fuchsia-500/20 to-pink-500/20 rounded-full blur-3xl animate-float-delayed" />
      </section>

      {/* Features Section */}
      <section id="features" className="relative container mx-auto px-4 py-24">
        <div className="max-w-6xl mx-auto">
          {/* Section header */}
          <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
            <h2 className="text-4xl sm:text-5xl font-bold">
              Everything You Need to
              <span className="block bg-gradient-to-r from-violet-600 to-fuchsia-600 bg-clip-text text-transparent">
                Scale Your Community
              </span>
            </h2>
            <p className="text-xl text-muted-foreground">
              Powerful automation tools designed for modern event organizers
            </p>
          </div>

          {/* Features grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Feature 1 */}
            <div className="group relative p-8 rounded-2xl border bg-card hover:shadow-xl hover:shadow-violet-500/10 transition-all duration-300 hover:-translate-y-1">
              <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-purple-500/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative space-y-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center">
                  <Calendar className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-xl font-semibold">Smart Event Management</h3>
                <p className="text-muted-foreground">
                  Organize events and speakers in one central hub. Track details, schedules, and speaker information effortlessly.
                </p>
              </div>
            </div>

            {/* Feature 2 */}
            <div className="group relative p-8 rounded-2xl border bg-card hover:shadow-xl hover:shadow-purple-500/10 transition-all duration-300 hover:-translate-y-1">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-fuchsia-500/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative space-y-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-fuchsia-500 flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-xl font-semibold">AI-Powered Content</h3>
                <p className="text-muted-foreground">
                  Generate engaging speaker announcements and promotional content with cutting-edge AI. Save hours of copywriting.
                </p>
              </div>
            </div>

            {/* Feature 3 */}
            <div className="group relative p-8 rounded-2xl border bg-card hover:shadow-xl hover:shadow-fuchsia-500/10 transition-all duration-300 hover:-translate-y-1">
              <div className="absolute inset-0 bg-gradient-to-br from-fuchsia-500/5 to-pink-500/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative space-y-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-fuchsia-500 to-pink-500 flex items-center justify-center">
                  <MessageSquare className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-xl font-semibold">Multi-Platform Publishing</h3>
                <p className="text-muted-foreground">
                  Post to LinkedIn, X (Twitter), and Instagram simultaneously. Schedule drip campaigns to maximize engagement.
                </p>
              </div>
            </div>

            {/* Feature 4 */}
            <div className="group relative p-8 rounded-2xl border bg-card hover:shadow-xl hover:shadow-cyan-500/10 transition-all duration-300 hover:-translate-y-1">
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-blue-500/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative space-y-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center">
                  <Zap className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-xl font-semibold">Automated Drip Campaigns</h3>
                <p className="text-muted-foreground">
                  Set up automated speaker announcement campaigns. Build anticipation and drive ticket sales on autopilot.
                </p>
              </div>
            </div>

            {/* Feature 5 */}
            <div className="group relative p-8 rounded-2xl border bg-card hover:shadow-xl hover:shadow-emerald-500/10 transition-all duration-300 hover:-translate-y-1">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-green-500/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative space-y-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-green-500 flex items-center justify-center">
                  <Users className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-xl font-semibold">Community Growth Tools</h3>
                <p className="text-muted-foreground">
                  Amplify your speakers' voices and tap into their networks. Grow your community exponentially with each event.
                </p>
              </div>
            </div>

            {/* Feature 6 */}
            <div className="group relative p-8 rounded-2xl border bg-card hover:shadow-xl hover:shadow-amber-500/10 transition-all duration-300 hover:-translate-y-1">
              <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-orange-500/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative space-y-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-xl font-semibold">Analytics & Insights</h3>
                <p className="text-muted-foreground">
                  Track engagement, reach, and conversion metrics. Make data-driven decisions to optimize your events.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative container mx-auto px-4 py-24">
        <div className="max-w-4xl mx-auto">
          <div className="relative overflow-hidden rounded-3xl border bg-gradient-to-br from-violet-600 via-purple-600 to-fuchsia-600 p-12 lg:p-16 text-center text-white shadow-2xl shadow-violet-500/50">
            <div className="absolute inset-0 bg-grid-pattern opacity-10" />
            <div className="relative space-y-6">
              <h2 className="text-4xl sm:text-5xl font-bold">
                Ready to Build Your Community?
              </h2>
              <p className="text-xl text-violet-100 max-w-2xl mx-auto">
                Join event organizers who are scaling their communities with AI-powered automation.
              </p>
              <div className="pt-4">
                <Link href="/login">
                  <Button size="lg" variant="secondary" className="text-lg px-8 h-14 bg-white text-violet-600 hover:bg-violet-50 shadow-xl">
                    Start Free Today
                    <ArrowRight className="ml-2 w-5 h-5" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative border-t">
        <div className="container mx-auto px-4 py-12">
          <div className="text-center text-sm text-muted-foreground">
            <p>&copy; {new Date().getFullYear()} MaxStation AI. Built for community builders.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
