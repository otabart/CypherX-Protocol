import React from "react";
import Image from "next/image";

const partners = [
  {
    src: "https://res.cloudinary.com/dsr37ut2z/image/upload/v1691545750/marketplace/covalent_marketing_dt84ka.png",
    alt: "Covalent",
    link: "https://www.covalenthq.com/",
  },
  {
    src: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/Uniswap_Logo_and_Wordmark.svg/2560px-Uniswap_Logo_and_Wordmark.svg.png",
    alt: "Uniswap",
    link: "https://uniswap.org/",
  },
  {
    src: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/Coinbase.svg/2560px-Coinbase.svg.png",
    alt: "Coinbase",
    link: "https://www.coinbase.com/",
  },
  {
    src: "https://www.datocms-assets.com/105223/1701819587-logo.svg",
    alt: "Alchemy",
    link: "https://www.alchemy.com/",
  },
  {
    src: "https://landing.coingecko.com/wp-content/uploads/2020/03/CoinGecko.png",
    alt: "CoinGecko",
    link: "https://www.coingecko.com/",
  },
];

export default function PartnersScroller() {
  return (
    <div className="relative w-full overflow-hidden bg-gray-100 py-6">
      {/* Marquee animation styles */}
      <style jsx>{`
        .marquee-track {
          display: flex;
          flex-wrap: nowrap;
          white-space: nowrap;
          width: 200%;
          /* ~20s cycle for desktops */
          animation: scroll-desktop 20s linear infinite;
        }
        @keyframes scroll-desktop {
          0% {
            transform: translateX(0%);
          }
          100% {
            transform: translateX(-50%);
          }
        }
        /* Faster on mobile (~8s cycle) */
        @media (max-width: 768px) {
          .marquee-track {
            animation: scroll-mobile 8s linear infinite;
          }
          @keyframes scroll-mobile {
            0% {
              transform: translateX(0%);
            }
            100% {
              transform: translateX(-50%);
            }
          }
        }
      `}</style>

      <div className="marquee-track">
        {/* First set of logos */}
        <div className="flex flex-nowrap items-center gap-6 sm:gap-16 md:gap-18 lg:gap-24 mr-6 sm:mr-16 md:mr-18 lg:mr-24">
          {partners.map((partner, idx) => (
            <div key={`p1-${idx}`} className="flex-shrink-0">
              <a href={partner.link} target="_blank" rel="noopener noreferrer">
                <Image
                  src={partner.src}
                  alt={partner.alt}
                  className="h-auto w-[60px] sm:w-[80px] md:w-[100px] lg:w-[120px]"
                  width={120}
                  height={80}
                  style={{ objectFit: "contain" }}
                />
              </a>
            </div>
          ))}
        </div>

        {/* Second set of logos */}
        <div className="flex flex-nowrap items-center gap-6 sm:gap-16 md:gap-18 lg:gap-24">
          {partners.map((partner, idx) => (
            <div key={`p2-${idx}`} className="flex-shrink-0">
              <a href={partner.link} target="_blank" rel="noopener noreferrer">
                <Image
                  src={partner.src}
                  alt={partner.alt}
                  className="h-auto w-[60px] sm:w-[80px] md:w-[100px] lg:w-[120px]"
                  width={120}
                  height={80}
                  style={{ objectFit: "contain" }}
                />
              </a>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}






