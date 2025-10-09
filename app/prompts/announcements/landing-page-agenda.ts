import { Database } from "@/types/supabase";

type EventType = Database["public"]["Tables"]["events"]["Row"];
type SpeakerType = Database["public"]["Tables"]["speakers"]["Row"];

export function landingPageAgendaPrompt(speakers: SpeakerType[], event: EventType) {

    const speakerData = speakers.map((speaker) => {
        return `
        ### ${speaker.name}
        “””
        ${speaker.session_description}
        ${speaker.session_title}
        ${speaker.speaker_title}
        ${speaker.speaker_bio}
        ${speaker.session_description}
        “””
        `
    })


    return `

# DeepStation Agenda Prompt

## Role
You organize the speaker data into an agenda similarly to the examples
For the emoji lists such as the end of page details, treat them as bullet points and provide a double line break between them

## Instructions
- Do NOT invent or fabricate any links. If you are not provided a link, do not make one up – simply leave it as plain text

## **Event Data:**
"""
📅 ${event.date}
⏰ ${event.start_time} to ${event.end_time} ${event.timezone}
📍 ${event.location}
${event.ticket_url ? `🎟️ Event Page: ${event.ticket_url}` : ''}
"""

## Speaker Data

${speakerData.length > 0 ? "Speakers:" : ""}
${speakerData.join("\n\n")}

## Examples:

### Example 1:
"""
​What is DeepStation?
---------------------

​We're on a mission to create the world's most connected AI learning community. As an official [OpenAI Academy Launch Partner](https://academy.openai.com/public/events/automate-knowledge-graphs-for-rag-building-graphrag-with-openai-api-1xxbklkylk) with 3,000+ global members, we're building more than AI skills through expert-led workshops and regional summits---we're creating economic development ecosystems where innovators are made.

​​Speakers:
===========

1.  ​​[William Falcon](https://www.linkedin.com/in/wfalcon),\
    Founder and CEO, Lightning AI\
    Founder, PyTorch Lightning

2.  ​[Aleksey Romanov](https://www.linkedin.com/in/aleksey-romanov?miniProfileUrn=urn%3Ali%3Afs_miniProfile%3AACoAACJTjqoBu-qmSlth9IFEH7kJzEKNRIlGtn0&lipi=urn%3Ali%3Apage%3Ad_flagship3_search_srp_all%3BtNhGwkUBQLmoeBJyQykr%2FA%3D%3D),\
    Senior Staff Data Scientist, Grid Dynamics

* * * * *

​​Agenda:
=========

-   ​​6:00 - 6:30 PM: Check-in and Networking

-   ​​6:30 - 6:35 PM: Opening remarks by hosts and shoutout to sponsors

-   ​​6:35 - 6:50 PM: Lightning AI Community Chat

-   ​6:50 - 8:20: Lightning AI Agents: Build Scalable AI with Lightning + Q&A

-   ​​8:30 - 8:40 PM: Closing remarks by hosts

-   ​​8:40 - 9:45 PM: Networking & Conversations

​​Session Title: "Lightning AI Agents: Build Scalable AI with Lightning"

​​Speaker:

​​👤 [William Falcon](https://www.linkedin.com/in/wfalcon), Founder and CEO, Lightning AI

​​Description:

​​💡 Join William Falcon, creator of PyTorch Lightning and CEO of Lightning AI, for a hands-on session on AI agent development. He'll introduce Lightning AI's latest tools and demonstrate how they enable you to build lightning-fast, production-ready agents that scale effortlessly.

* * * * *

​​🙇‍♂️ Sponsored by Miami Tech Works
-------------------------------------------------------------------------------------------------------------------

​​Aligning South Florida employers, tech talent, and training partners to build a sustainable technology-talent pipeline.

* * * * *

​📅 September 16th, 2025
​⏰ 6:00 PM to 9:30 PM ET
​📍 Location: The LAB Miami

​📩 Be a Speaker: https://forms.gle/hXB6Jb83xEMz1c389
​📩 Be a Sponsor: https://forms.gle/fjroGZm8TyQzVYMF6

​🤗 Follow us on all our socials: https://DeepStation.ai/connect
"""
`
}