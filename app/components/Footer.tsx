const Footer = () => {
  return (
    <footer className="bg-[#A5CFFF] text-[#1A2233] py-6 border-t border-blue-500/30">
      <div className="container mx-auto flex flex-col md:flex-row justify-between items-center">
        {/* Logo and Description */}
        <div className="mb-4 md:mb-0 text-center md:text-left">
          <h2 className="text-2xl font-bold text-[#1A2233]">Homebase</h2>
          <p className="text-sm mt-2 text-[#1A2233]/80">
            Your go-to platform for Base chain analytics and insights.
          </p>
        </div>

        {/* Links */}
        <div className="flex flex-col md:flex-row gap-4 text-center md:text-right">
          <a href="/" className="text-[#1A2233] hover:text-blue-400 transition-colors">
            Home
          </a>
          <a href="/token-scanner" className="text-[#1A2233] hover:text-blue-400 transition-colors">
            Token Screener
          </a>
          <a href="/marketplace" className="text-[#1A2233] hover:text-blue-400 transition-colors">
            Marketplace
          </a>
          <a href="/TradingCompetition" className="text-[#1A2233] hover:text-blue-400 transition-colors">
            Tournaments
          </a>
          <a href="/terminal" className="text-[#1A2233] hover:text-blue-400 transition-colors">
            Terminal
          </a>
          <a href="/docs" className="text-[#1A2233] hover:text-blue-400 transition-colors">
            Docs
          </a>
          <a href="mailto:homebasemarkets@gmail.com" className="text-[#1A2233] hover:text-blue-400 transition-colors">
            Contact
          </a>
        </div>

        {/* Social Media Links */}
        <div className="flex gap-4 mt-4 md:mt-0">
          <a
            href="https://twitter.com/HomebaseMarkets"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="X (Twitter)"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-6 h-6 text-[#1A2233] hover:text-blue-400 transition-colors"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M22.162 5.656c-.806.358-1.675.599-2.582.709a4.515 4.515 0 001.981-2.481 8.94 8.94 0 01-2.859 1.098 4.515 4.515 0 00-7.692 4.119A12.828 12.828 0 013.437 4.4a4.515 4.515 0 001.401 6.032 4.515 4.515 0 01-2.043-.566v.056a4.515 4.515 0 003.623 4.426 4.515 4.515 0 01-2.037.078 4.515 4.515 0 004.217 3.141 9.03 9.03 0 01-5.607 1.932c-.365 0-.729-.021-1.088-.064a12.794 12.794 0 006.92 2.028c8.302 0 12.838-6.877 12.838-12.837 0-.196-.004-.393-.013-.589a9.14 9.14 0 002.25-2.33z"
              />
            </svg>
          </a>
          <a
            href="https://t.me/HomebaseMarkets"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Telegram"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-6 h-6 text-[#1A2233] hover:text-blue-400 transition-colors"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21.75 3.75L2.25 10.5l7.5 3 2.25 7.5 4.5-6.75 6-4.5-1.5-5.25z"
              />
            </svg>
          </a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;