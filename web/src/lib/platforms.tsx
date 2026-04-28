import { ArrowUpRight } from "lucide-react";
import type { IconType } from "react-icons";
import {
  FaBandcamp,
  FaFacebookF,
  FaInstagram,
  FaRedditAlien,
  FaSoundcloud,
  FaSpotify,
  FaTiktok,
  FaTwitch,
  FaVimeoV,
  FaVk,
  FaXTwitter,
  FaYoutube,
} from "react-icons/fa6";
import {
  SiApplemusic,
  SiApplepodcasts,
  SiArchiveofourown,
  SiAudiomack,
  SiBilibili,
  SiBluesky,
  SiBox,
  SiDailymotion,
  SiDropbox,
  SiGoogledrive,
  SiImdb,
  SiImgur,
  SiInternetarchive,
  SiKick,
  SiMixcloud,
  SiPatreon,
  SiRumble,
  SiSnapchat,
  SiSteam,
  SiSubstack,
  SiTelegram,
  SiTriller,
  SiTumblr,
} from "react-icons/si";
import { cn } from "@/lib/utils";

export interface PlatformInfo {
  key: string;
  label: string;
  hosts: string[];
  icon?: IconType;
  iconClassName?: string;
}

const PLATFORM_REGISTRY: PlatformInfo[] = [
  {
    key: "youtube",
    label: "YouTube",
    hosts: ["youtube.com", "youtu.be", "m.youtube.com", "music.youtube.com"],
    icon: FaYoutube,
    iconClassName: "text-[#ff4343]",
  },
  {
    key: "soundcloud",
    label: "SoundCloud",
    hosts: ["soundcloud.com", "on.soundcloud.com"],
    icon: FaSoundcloud,
    iconClassName: "text-[#ff6b1a]",
  },
  {
    key: "vimeo",
    label: "Vimeo",
    hosts: ["vimeo.com", "player.vimeo.com"],
    icon: FaVimeoV,
    iconClassName: "text-[#1ab7ea]",
  },
  {
    key: "tiktok",
    label: "TikTok",
    hosts: ["tiktok.com", "vm.tiktok.com", "vt.tiktok.com"],
    icon: FaTiktok,
    iconClassName: "text-white",
  },
  {
    key: "instagram",
    label: "Instagram",
    hosts: ["instagram.com"],
    icon: FaInstagram,
    iconClassName: "text-[#ff4f86]",
  },
  {
    key: "x",
    label: "X",
    hosts: ["x.com", "twitter.com", "mobile.twitter.com"],
    icon: FaXTwitter,
    iconClassName: "text-white",
  },
  {
    key: "facebook",
    label: "Facebook",
    hosts: ["facebook.com", "fb.watch", "m.facebook.com"],
    icon: FaFacebookF,
    iconClassName: "text-[#1877f2]",
  },
  {
    key: "twitch",
    label: "Twitch",
    hosts: ["twitch.tv", "clips.twitch.tv"],
    icon: FaTwitch,
    iconClassName: "text-[#a970ff]",
  },
  {
    key: "spotify",
    label: "Spotify",
    hosts: ["spotify.com", "open.spotify.com"],
    icon: FaSpotify,
    iconClassName: "text-[#1ed760]",
  },
  {
    key: "apple-music",
    label: "Apple Music",
    hosts: ["music.apple.com"],
    icon: SiApplemusic,
    iconClassName: "text-[#fa243c]",
  },
  {
    key: "apple-podcasts",
    label: "Apple Podcasts",
    hosts: ["podcasts.apple.com"],
    icon: SiApplepodcasts,
    iconClassName: "text-[#a650fe]",
  },
  {
    key: "vk",
    label: "VK",
    hosts: ["vk.com", "m.vk.com"],
    icon: FaVk,
    iconClassName: "text-[#4c75a3]",
  },
  {
    key: "reddit",
    label: "Reddit",
    hosts: ["reddit.com", "redd.it"],
    icon: FaRedditAlien,
    iconClassName: "text-[#ff4500]",
  },
  {
    key: "bandcamp",
    label: "Bandcamp",
    hosts: ["bandcamp.com"],
    icon: FaBandcamp,
    iconClassName: "text-[#629aa9]",
  },
  {
    key: "bilibili",
    label: "Bilibili",
    hosts: ["bilibili.com", "b23.tv"],
    icon: SiBilibili,
    iconClassName: "text-[#00a1d6]",
  },
  {
    key: "dailymotion",
    label: "Dailymotion",
    hosts: ["dailymotion.com", "dai.ly"],
    icon: SiDailymotion,
    iconClassName: "text-[#6c5cff]",
  },
  {
    key: "kick",
    label: "Kick",
    hosts: ["kick.com"],
    icon: SiKick,
    iconClassName: "text-[#53fc18]",
  },
  {
    key: "bluesky",
    label: "Bluesky",
    hosts: ["bsky.app"],
    icon: SiBluesky,
    iconClassName: "text-[#1185fe]",
  },
  {
    key: "mixcloud",
    label: "Mixcloud",
    hosts: ["mixcloud.com"],
    icon: SiMixcloud,
    iconClassName: "text-[#5000ff]",
  },
  {
    key: "telegram",
    label: "Telegram",
    hosts: ["t.me", "telegram.me", "telegram.org"],
    icon: SiTelegram,
    iconClassName: "text-[#27a7e7]",
  },
  {
    key: "rumble",
    label: "Rumble",
    hosts: ["rumble.com"],
    icon: SiRumble,
    iconClassName: "text-[#85c742]",
  },
  {
    key: "tumblr",
    label: "Tumblr",
    hosts: ["tumblr.com"],
    icon: SiTumblr,
    iconClassName: "text-[#36465d]",
  },
  {
    key: "steam",
    label: "Steam",
    hosts: ["steampowered.com", "steamcommunity.com"],
    icon: SiSteam,
    iconClassName: "text-[#c7d5e0]",
  },
  {
    key: "snapchat",
    label: "Snapchat",
    hosts: ["snapchat.com"],
    icon: SiSnapchat,
    iconClassName: "text-[#fffc00]",
  },
  {
    key: "dropbox",
    label: "Dropbox",
    hosts: ["dropbox.com", "db.tt"],
    icon: SiDropbox,
    iconClassName: "text-[#0061ff]",
  },
  {
    key: "google-drive",
    label: "Google Drive",
    hosts: ["drive.google.com"],
    icon: SiGoogledrive,
    iconClassName: "text-[#8ab4f8]",
  },
  {
    key: "box",
    label: "Box",
    hosts: ["box.com", "app.box.com"],
    icon: SiBox,
    iconClassName: "text-[#0061d5]",
  },
  {
    key: "patreon",
    label: "Patreon",
    hosts: ["patreon.com"],
    icon: SiPatreon,
    iconClassName: "text-[#ff424d]",
  },
  {
    key: "substack",
    label: "Substack",
    hosts: ["substack.com"],
    icon: SiSubstack,
    iconClassName: "text-[#ff6719]",
  },
  {
    key: "vevo",
    label: "Vevo",
    hosts: ["vevo.com"],
  },
  {
    key: "triller",
    label: "Triller",
    hosts: ["triller.co"],
    icon: SiTriller,
    iconClassName: "text-white",
  },
  {
    key: "audiomack",
    label: "Audiomack",
    hosts: ["audiomack.com"],
    icon: SiAudiomack,
    iconClassName: "text-[#ffa200]",
  },
  {
    key: "audius",
    label: "Audius",
    hosts: ["audius.co"],
  },
  {
    key: "internet-archive",
    label: "Internet Archive",
    hosts: ["archive.org", "web.archive.org"],
    icon: SiInternetarchive,
    iconClassName: "text-[#9b9486]",
  },
  {
    key: "imgur",
    label: "Imgur",
    hosts: ["imgur.com"],
    icon: SiImgur,
    iconClassName: "text-[#1bb76e]",
  },
  {
    key: "imdb",
    label: "IMDb",
    hosts: ["imdb.com"],
    icon: SiImdb,
    iconClassName: "text-[#f5c518]",
  },
  {
    key: "coub",
    label: "Coub",
    hosts: ["coub.com"],
  },
  {
    key: "ao3",
    label: "Archive of Our Own",
    hosts: ["archiveofourown.org"],
    icon: SiArchiveofourown,
    iconClassName: "text-[#990000]",
  },
];

const IGNORED_SUBDOMAINS = new Set(["www", "m", "mobile", "music", "play", "player", "watch", "amp"]);

export function resolvePlatform(value: string): PlatformInfo {
  const hostname = getNormalizedHostname(value);
  if (!hostname) {
    return createFallbackPlatform("media");
  }

  const match = PLATFORM_REGISTRY.find((platform) =>
    platform.hosts.some((host) => hostname === host || hostname.endsWith(`.${host}`)),
  );

  if (match) {
    return match;
  }

  return createFallbackPlatform(getPrimaryDomainLabel(hostname));
}

export function getPlatformLabel(value: string) {
  return resolvePlatform(value).label;
}

export function PlatformIcon({
  platform,
  className,
}: {
  platform: PlatformInfo;
  className?: string;
}) {
  if (!platform.icon) {
    return <ArrowUpRight className={cn("size-5 text-muted-foreground", className)} aria-hidden="true" />;
  }

  const Icon = platform.icon;
  return <Icon className={cn("size-5", platform.iconClassName, className)} aria-hidden="true" />;
}

function createFallbackPlatform(label: string): PlatformInfo {
  return {
    key: "generic",
    label: humanizeLabel(label),
    hosts: [],
  };
}

function getNormalizedHostname(value: string) {
  try {
    return new URL(value).hostname.toLowerCase().replace(/\.$/, "");
  } catch {
    return "";
  }
}

function getPrimaryDomainLabel(hostname: string) {
  const parts = hostname.split(".").filter(Boolean);
  if (parts.length === 0) {
    return hostname;
  }

  const preferred = parts.find((part, index) => index === parts.length - 1 || !IGNORED_SUBDOMAINS.has(part));
  return preferred ?? parts[0];
}

function humanizeLabel(value: string) {
  return value
    .split(/[-_]+/g)
    .filter(Boolean)
    .map((part) => {
      if (part.length <= 2) {
        return part.toUpperCase();
      }

      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(" ");
}
