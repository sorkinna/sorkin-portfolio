import React from "react";

export default function AboutMe() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-12 space-y-12">
      {/* Header */}
      <section className="text-center space-y-4">
        <h1 className="text-4xl font-bold">Nick Sorkin</h1>
        <p className="text-lg text-gray-600">
          Software engineer, sports fan, movie critic, and dog enthusiast.
        </p>
      </section>

      {/* Profile + Intro */}
      <section className="grid md:grid-cols-2 gap-8 items-center">
        <div className="w-full h-85 rounded-2xl overflow-hidden">
          <span className="text-gray-500">
            <img src="/images/about/diamond.jpeg" alt="Diamond Dogs" className="w-full h-72 object-cover rounded-2xlw-full h-full object-cover object-[50%_65%]" />
          </span>
        </div>
        <div className="space-y-4 text-gray-700">
          <p>
            I’m a software engineer based in Richmond, Virginia, where I spend
            most of my time building cloud infrastructure and automation
            tools—and the rest of it obsessing over sports, movies, and whatever
            my dog wants to do that day.
          </p>
          <p>
            I was a Principal Software Developer at Capital One,
            focused on AWS infrastructure, network automation, and building
            systems that make large-scale environments easier to manage and more
            reliable.
          </p>
        </div>
      </section>

      {/* Work Section */}
      <section className="space-y-6">
        <h2 className="text-2xl font-semibold">What I Do</h2>
        <div className="grid md:grid-cols-3 gap-6">
          <div className="p-6 rounded-2xl shadow">
            <h3 className="font-semibold mb-2">Cloud Infrastructure</h3>
            <p className="text-gray-600 text-sm">
              Designing and provisioning scalable AWS environments including
              VPCs, networking, and multi-region systems.
            </p>
          </div>
          <div className="p-6 rounded-2xl shadow">
            <h3 className="font-semibold mb-2">Automation</h3>
            <p className="text-gray-600 text-sm">
              Building tools that remove manual work and make infrastructure
              easier to manage and operate.
            </p>
          </div>
          <div className="p-6 rounded-2xl shadow">
            <h3 className="font-semibold mb-2">Reliability</h3>
            <p className="text-gray-600 text-sm">
              Creating systems for failover testing and disaster recovery to
              ensure everything works when it matters most.
            </p>
          </div>
        </div>
      </section>

      {/* Sports + Movies */}
      <section className="grid md:grid-cols-2 gap-8 items-center">
        <div className="space-y-4 text-gray-700">
          <h2 className="text-2xl font-semibold">Outside of Work</h2>
          <p>
            I’m a huge sports fan and will watch pretty much anything—football,
            basketball, baseball, soccer, tennis, Formula 1, even darts. I’m a
            loyal fan of the Chiefs, Red Sox, Celtics, and Tottenham Hotspur.
          </p>
          <p>
            I also love movies. I’ve tracked every movie I’ve watched since 2020,
            which has turned into a bit of an obsession. Action, sci-fi, and 90s
            movies are my go-to.
          </p>
        </div>
          <div className="w-full h-72 bg-gray-200 rounded-2xl flex items-center justify-center mt-4">
            <div className="w-full h-75 rounded-2xl overflow-hidden">
              <span className="text-gray-500">
                <img src="/images/about/game.jpeg" alt="College Baseball World Series" className="w-full h-72 object-cover rounded-2xlw-full h-full object-cover object-[50%_65%]" />
              </span>
            </div>
        </div>
      </section>

      {/* Dog Section */}
      <section className="space-y-6">
        <h2 className="text-2xl font-semibold">My Dog</h2>
        <div className="grid md:grid-cols-2 gap-8 items-center">
          <div className="w-full h-106 rounded-2xl overflow-hidden">
            <img
              src="/images/about/dockdiving.gif"
              alt="Dakota diving"
              className="w-full h-full object-cover object-[50%_60%]"
            />
          </div>
          <div className="text-gray-700 space-y-4">
            <p>
              When I’m not working, I’m usually with my dog—taking him swimming,
              dock diving, or out on hikes. He is a Nova Scotia Duck Tolling Retriever.
              We love going up to Minnesota every year with family and enjoying the lake
              time and riding on the boat!
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <section className="text-center pt-8">
        <p className="text-gray-600">
          If you want to connect, talk shop, or debate sports and movies, feel
          free to reach out.
        </p>
      </section>
    </div>
  );
}
