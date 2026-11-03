/**
 * Three prepared memories, reached by the small numbers beside "Skip to a
 * sample story". Each goes through the flow as a recording would: its words
 * print on the transcript step and are read by the assessment like any other;
 * only the title and year are offered to naming, still editable there.
 */
export interface DemoMemory {
  title: string;
  /** Empty when the year was not given. */
  year: string;
  transcript: string;
}

export const DEMO_MEMORIES: DemoMemory[] = [
  {
    title: "designX 24!",
    year: "2024",
    transcript: [
      "24年的夏天，我在XA认识了几个特有意思的朋友。",
      "我们当时一起做助教，还住同一个宿舍。",
      "那两周特别开心。",
      "我们经常聊设计，我总能学到新的东西。",
      "现在想起来，觉得那段时间给了我很多动力。",
      "后来我们还一起做了一些项目，包括现在这个作品。",
      "太神奇了，没想到后来还能一起做这么多事情，希望以后也能一直这样啊。",
    ].join(" "),
  },
  {
    title: "that midnight parking lot",
    year: "",
    transcript: "I remember this one night last spring when him and I went for a drive around LA. It was midnight, and we didn't really have anywhere to go. We stopped at this parking lot overlooking the city, listening to music with the windows down. We were talking about graduation, and how weird it felt that everyone was figuring out what to do next. At some point we just stopped talking. I don't remember how long we stayed, but I still think about that night sometimes.",
  },
  {
    title: "東京で創った日",
    year: "2026",
    transcript: [
      "先月、ずっと憧れていたデザイナーに会うために、東京まで行きました。",
      "東京の街を歩きながら、アイデアを話したり、一緒に撮影をしたりして、忘れられない一日になりました。",
      "こんなに自然にアイデアが生まれるなんて、すごく不思議でした。",
      "やっぱり、クリエイティブな人たちはもっと会って、一緒に何かを作るべきだなって思いました。",
    ].join(" "),
  },
];
