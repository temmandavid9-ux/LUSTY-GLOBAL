import { Mail } from 'lucide-react';

export default function SupportEmailLink({ 
  email = "temmandavid9@gmail.com", 
  subject = "Lusty Global Support Inquiry",
  className = ""
}: { 
  email?: string; 
  subject?: string;
  className?: string;
}) {
  const mailtoUrl = `mailto:${email}?subject=${encodeURIComponent(subject)}`;

  return (
    <a
      href={mailtoUrl}
      className={`flex items-center gap-2 text-xs text-zinc-400 hover:text-sky-400 transition font-mono ${className}`}
    >
      <Mail className="w-4 h-4 text-sky-400" />
      <span>{email}</span>
    </a>
  );
}
