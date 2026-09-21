import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { confirm } from '@/components/ui/confirm';
import { EmptyState } from '@/components/ui/empty-state';
import { ScreenLoader } from '@/components/ui/loader';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { useToast } from '@/components/ui/toast';
import type { Contact } from '@/db/types';
import { PermissionDeniedError, pickImages, takePhoto } from '@/features/attachments/picker';
import type { PickedFile } from '@/features/attachments/types';
import { ContactAvatar } from '@/features/contacts/components/contact-avatar';
import { useContact, useDeleteContact, useSaveContact } from '@/features/contacts/hooks';
import { goBack } from '@/lib/navigation';
import { spacing } from '@/theme/tokens';

export default function ContactFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { data, isPending } = useContact(id);
  if (id && isPending) return <ScreenLoader />;
  if (id && !data) return <EmptyState icon="search-outline" title="Contact not found" />;
  return <ContactForm key={data?.id ?? 'new'} existing={data ?? null} />;
}

function ContactForm({ existing }: { existing: Contact | null }) {
  const toast = useToast();
  const save = useSaveContact();
  const remove = useDeleteContact();

  const [name, setName] = useState(existing?.name ?? '');
  const [phone, setPhone] = useState(existing?.phone ?? '');
  const [email, setEmail] = useState(existing?.email ?? '');
  const [address, setAddress] = useState(existing?.address ?? '');
  const [note, setNote] = useState(existing?.note ?? '');
  const [photoUri, setPhotoUri] = useState<string | null>(existing?.photoUri ?? null);
  const [photo, setPhoto] = useState<PickedFile | null>(null);
  const [error, setError] = useState<string | null>(null);

  const addPhoto = async (pick: () => Promise<PickedFile[]>) => {
    try {
      const [picked] = await pick();
      if (!picked) return;
      setPhoto(picked);
      setPhotoUri(picked.uri);
    } catch (e) {
      toast.error(
        e instanceof PermissionDeniedError
          ? e.message
          : 'Could not add the photo. Please try again.'
      );
    }
  };

  const submit = async () => {
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    try {
      await save.mutateAsync({
        id: existing?.id,
        input: {
          name: name.trim(),
          // Keep the stored photo unless a new one was picked.
          photoUri: photo ? (existing?.photoUri ?? null) : photoUri,
          photo,
          phone: phone.trim() || null,
          email: email.trim() || null,
          address: address.trim() || null,
          note: note.trim() || null,
        },
      });
      toast.success(existing ? 'Contact updated' : 'Contact added');
      goBack('/contacts');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the contact');
    }
  };

  const handleDelete = async () => {
    if (!existing) return;
    const ok = await confirm({
      title: `Delete ${existing.name}?`,
      message: existing.obligationCount
        ? `Their ${existing.obligationCount} outstanding record${
            existing.obligationCount === 1 ? '' : 's'
          } go too. Payments already recorded stay in your ledger.`
        : 'This contact will be removed.',
    });
    if (!ok) return;
    try {
      await remove.mutateAsync(existing.id);
      toast.success('Contact deleted');
      goBack('/contacts');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not delete the contact');
    }
  };

  return (
    <Screen
      keyboard
      safeBottom
      footer={
        <Button
          title={existing ? 'Save changes' : 'Add contact'}
          icon="checkmark"
          loading={save.isPending}
          onPress={submit}
        />
      }>
      <Stack.Screen options={{ title: existing ? 'Edit contact' : 'New contact' }} />

      <Card style={styles.photoCard}>
        <PressableScale
          scaleTo={0.95}
          onPress={() => addPhoto(() => pickImages(1))}
          accessibilityLabel="Choose a photo">
          <ContactAvatar name={name || '?'} photoUri={photoUri} size={88} />
        </PressableScale>
        <View style={styles.photoActions}>
          <Button
            title={photoUri ? 'Change photo' : 'Add photo'}
            icon="image-outline"
            size="sm"
            variant="outline"
            onPress={() => addPhoto(() => pickImages(1))}
          />
          <Button
            title="Camera"
            icon="camera-outline"
            size="sm"
            variant="outline"
            onPress={() => addPhoto(takePhoto)}
          />
          {photoUri ? (
            <Button
              title="Remove"
              icon="close"
              size="sm"
              variant="ghost"
              onPress={() => {
                setPhoto(null);
                setPhotoUri(null);
              }}
            />
          ) : null}
        </View>
      </Card>

      <TextField
        label="Name"
        value={name}
        onChangeText={(value) => {
          setName(value);
          setError(null);
        }}
        placeholder="Who is this?"
        maxLength={80}
        error={error}
        autoFocus={!existing}
      />
      <TextField
        label="Phone"
        value={phone}
        onChangeText={setPhone}
        placeholder="Optional"
        keyboardType="phone-pad"
        inputMode="tel"
        maxLength={40}
      />
      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        placeholder="Optional"
        keyboardType="email-address"
        inputMode="email"
        autoCapitalize="none"
        maxLength={120}
      />
      <TextField
        label="Address"
        value={address}
        onChangeText={setAddress}
        placeholder="Optional"
        multiline
        maxLength={200}
      />
      <TextField
        label="Note"
        value={note}
        onChangeText={setNote}
        placeholder="Anything worth remembering"
        multiline
        maxLength={500}
      />

      {existing ? (
        <>
          <Button
            title="Delete contact"
            icon="trash-outline"
            variant="danger"
            loading={remove.isPending}
            onPress={handleDelete}
          />
          <Text variant="caption" color="textMuted" align="center">
            Payments already recorded stay in your ledger.
          </Text>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  photoCard: {
    alignItems: 'center',
    gap: spacing.md,
  },
  photoActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
  },
});
