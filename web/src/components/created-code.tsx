import { useState } from 'react';
import { copyText, shareText } from '@/lib/links';
import { colors, radius } from '@/theme';
import { Button } from './ui/button';
import { Icon } from './ui/icon';
import { delay } from './ui/misc';
import { Text } from './ui/text';

/** Shown after a room or course is created: the join code, big and copyable. */
export function CreatedCode({ title, subtitle, code, shareMessage, doneLabel, onDone }: {
  title: string; subtitle: string; code: string; shareMessage: string; doneLabel: string; onDone: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState<string | null>(null);
  return (
    <div className="page">
      <div className="content narrow a-fade" style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 14 }}>
        <span className="h center a-zoom" style={{ width: 76, height: 76, borderRadius: 38, backgroundColor: colors.success, marginBottom: 6 }}>
          <Icon name="checkmark" size={36} color="#fff" />
        </span>
        <Text variant="title" style={{ textAlign: 'center' }}>{title}</Text>
        <Text color={colors.muted} style={{ textAlign: 'center' }}>{subtitle}</Text>

        <div className="v" style={{ alignItems: 'center', gap: 10, margin: '16px 0' }}>
          <Text variant="label" color={colors.muted}>Join code</Text>
          <div className="h" style={{ gap: 8 }}>
            {code.split('').map((c, i) => (
              <span key={i} className="h center a-down" style={{ ...delay(150 + i * 60), width: 44, height: 54, borderRadius: radius.md, backgroundColor: colors.primarySoft }}>
                <Text variant="title" color={colors.primary}>{c}</Text>
              </span>
            ))}
          </div>
        </div>

        <div className="v" style={{ gap: 10, alignSelf: 'stretch' }}>
          <Button
            title={copied ? 'Copied' : 'Copy code'}
            icon={copied ? 'checkmark' : 'copy-outline'}
            variant="secondary"
            onPress={async () => { await copyText(code); setCopied(true); }}
          />
          <Button
            title={shared ?? 'Share invite'}
            icon="share-outline"
            onPress={async () => {
              const how = await shareText(shareMessage);
              if (how === 'copied') setShared('Invite copied');
            }}
          />
          <Button title={doneLabel} variant="ghost" onPress={onDone} />
        </div>
      </div>
    </div>
  );
}
