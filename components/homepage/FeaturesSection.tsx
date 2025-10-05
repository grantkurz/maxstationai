import { Camera, Clock, Shield, Star } from "lucide-react"
import { Badge } from "@/components/ui/badge"

const features = [
  {
    title: "Automated Marketing",
    description: "AI-powered campaigns and personalized attendee communications",
    icon: <Star className="h-6 w-6" />
  },
  {
    title: "Real-time Analytics",
    description: "Track attendance, engagement, and event metrics in real-time",
    icon: <Camera className="h-6 w-6" />
  },
  {
    title: "Multi-channel Promotion",
    description: "Promote your event across email, social media, and SMS",
    icon: <Clock className="h-6 w-6" />
  },
  {
    title: "Attendee Management",
    description: "Manage attendees, send updates, and handle check-ins effortlessly",
    icon: <Shield className="h-6 w-6" />
  },
]


export default function FeaturesSection() {
  return (
    <section className="py-20 md:py-32 bg-muted/30">
      <div className="container px-4 md:px-6">
        <div className="text-center mb-12">
          <Badge variant="outline" className="mb-4">Features</Badge>
          <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">
            Everything You Need for Perfect Event Marketing
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div key={index} className="p-6 rounded-lg bg-background border">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                {feature.icon}
              </div>
              <h3 className="font-semibold mb-2">{feature.title}</h3>
              <p className="text-muted-foreground">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}