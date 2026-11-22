import { useEffect, useState } from "react";

const photos = [
  "/hero-bedroom.jpg",
  "/hero-apartment.jpg",
  "/hero-boardinghouse.jpg",
  "/hero-condo.jpg",
  "/hero-house.jpg",
];

// Stacks every photo behind the hero and crossfades between them.
export default function HeroBackdrop() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setActive((i) => (i + 1) % photos.length);
    }, 6000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="hero-backdrop" aria-hidden="true">
      {photos.map((src, i) => (
        <div
          key={src}
          className={`hero-photo${i === active ? " is-active" : ""}`}
          style={{ backgroundImage: `url("${src}")` }}
        />
      ))}
    </div>
  );
}