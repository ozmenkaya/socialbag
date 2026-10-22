'use client';

import React, { FC, useCallback, useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import clsx from 'clsx';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useModals } from '@gitroom/frontend/components/layout/new-modal';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { deleteDialog } from '@gitroom/react/helpers/delete.dialog';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { Button } from '@gitroom/react/form/button';

export interface MediaFolderItem {
  id: string;
  name: string;
  parentId: string | null;
  count: number;
  integrations: {
    id: string;
    name: string;
    picture?: string;
    providerIdentifier: string;
  }[];
  autoPost: {
    enabled: boolean;
    days: number[];
    time: string;
    timezone: string;
    content: string;
  };
}

// 'all' lists every media, 'root' only media outside folders
export type FolderSelection = 'all' | 'root' | string;

export const useMediaFolders = () => {
  const fetch = useFetch();
  const load = useCallback(async () => {
    return (await fetch('/media-folders')).json();
  }, [fetch]);

  return useSWR<MediaFolderItem[]>('media-folders', load);
};

const useFolderIntegrationList = () => {
  const fetch = useFetch();
  const load = useCallback(async () => {
    return (await (await fetch('/integrations/list')).json()).integrations;
  }, [fetch]);

  return useSWR<
    { id: string; name: string; picture?: string; identifier: string; disabled?: boolean }[]
  >('media-folders-integrations', load, { revalidateOnFocus: false });
};

const errorMessage = async (response: Response, fallback: string) => {
  const body = await response.json().catch(() => ({}));
  return (Array.isArray(body.message) ? body.message[0] : body.message) || fallback;
};

// "A / B / C" path of a folder, used in pickers
export const folderPath = (folders: MediaFolderItem[], id: string) => {
  const names: string[] = [];
  let current = folders.find((p) => p.id === id);
  while (current) {
    names.unshift(current.name);
    current = folders.find((p) => p.id === current!.parentId);
  }

  return names.join(' / ');
};

const FolderNameModal: FC<{
  initial?: string;
  onSave: (name: string) => Promise<boolean>;
}> = ({ initial, onSave }) => {
  const t = useT();
  const modals = useModals();
  const [name, setName] = useState(initial || '');
  const [saving, setSaving] = useState(false);

  const save = useCallback(async () => {
    if (!name.trim()) {
      return;
    }
    setSaving(true);
    const ok = await onSave(name.trim());
    setSaving(false);
    if (ok) {
      modals.closeCurrent();
    }
  }, [name, onSave, modals]);

  return (
    <div className="flex flex-col gap-[16px]">
      <input
        autoFocus={true}
        value={name}
        maxLength={100}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && save()}
        placeholder={t('folder_name', 'Folder name')}
        className="w-full h-[44px] px-[14px] rounded-[8px] bg-newBgColorInner border border-newColColor text-[14px] outline-none focus:border-[#612BD3]"
      />
      <div className="flex justify-end">
        <Button onClick={save} loading={saving} disabled={!name.trim()}>
          {t('save', 'Save')}
        </Button>
      </div>
    </div>
  );
};

const FolderChannelsModal: FC<{
  folder: MediaFolderItem;
  folders: MediaFolderItem[];
  onSaved: () => void;
}> = ({ folder, folders, onSaved }) => {
  const t = useT();
  const fetch = useFetch();
  const modals = useModals();
  const toaster = useToaster();
  const { data: integrations, isLoading } = useFolderIntegrationList();
  const [selected, setSelected] = useState<string[]>(
    folder.integrations.map((p) => p.id)
  );
  const [saving, setSaving] = useState(false);

  // a channel belongs to one folder, show where it is linked now
  const linkedElsewhere = useCallback(
    (integrationId: string) =>
      folders.find(
        (f) =>
          f.id !== folder.id &&
          f.integrations.some((p) => p.id === integrationId)
      ),
    [folders, folder.id]
  );

  const toggle = useCallback(
    (id: string) => () => {
      setSelected((prev) =>
        prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
      );
    },
    []
  );

  const save = useCallback(async () => {
    setSaving(true);
    const response = await fetch(`/media-folders/${folder.id}/integrations`, {
      method: 'PUT',
      body: JSON.stringify({ integrations: selected }),
    });
    setSaving(false);
    if (!response.ok) {
      toaster.show(
        await errorMessage(response, t('folder_channels_failed', 'Could not save the channels')),
        'warning'
      );
      return;
    }
    onSaved();
    modals.closeCurrent();
  }, [fetch, folder.id, selected, onSaved, modals, toaster, t]);

  return (
    <div className="flex flex-col gap-[16px]">
      <div className="text-textItemBlur text-[14px]">
        {t(
          'folder_channels_description',
          'When you create a post for these channels, the media library opens this folder and new uploads are saved here.'
        )}
      </div>
      {isLoading ? (
        <div className="text-textItemBlur">{t('loading', 'Loading...')}</div>
      ) : (
        <div className="flex flex-col gap-[8px] max-h-[400px] overflow-y-auto">
          {(integrations || [])
            .filter((p) => !p.disabled)
            .map((p) => {
              const other = linkedElsewhere(p.id);
              return (
                <label
                  key={p.id}
                  className="flex items-center gap-[10px] cursor-pointer p-[8px] rounded-[8px] hover:bg-boxHover"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(p.id)}
                    onChange={toggle(p.id)}
                  />
                  <img
                    className="w-[24px] h-[24px] rounded-full"
                    src={p.picture || '/no-picture.jpg'}
                  />
                  <div className="flex-1">
                    <div>{p.name}</div>
                    {!!other && !selected.includes(p.id) && (
                      <div className="text-[12px] text-textItemBlur">
                        {t('linked_to_folder', 'Linked to {{name}}', {
                          name: folderPath(folders, other.id),
                        })}
                      </div>
                    )}
                  </div>
                  <div className="text-[12px] text-textItemBlur">{p.identifier}</div>
                </label>
              );
            })}
        </div>
      )}
      <div className="flex justify-end">
        <Button onClick={save} loading={saving}>
          {t('save', 'Save')}
        </Button>
      </div>
    </div>
  );
};

const FolderAutoPostModal: FC<{
  folder: MediaFolderItem;
  onSaved: () => void;
}> = ({ folder, onSaved }) => {
  const t = useT();
  const fetch = useFetch();
  const modals = useModals();
  const toaster = useToaster();
  const browserTimezone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    []
  );
  const [enabled, setEnabled] = useState(folder.autoPost.enabled);
  const [days, setDays] = useState<number[]>(folder.autoPost.days);
  const [time, setTime] = useState(folder.autoPost.time);
  const [content, setContent] = useState(folder.autoPost.content);
  const [saving, setSaving] = useState(false);
  // a folder that was never set up follows the browser's timezone
  const timezone =
    folder.autoPost.enabled || folder.autoPost.timezone !== 'UTC'
      ? folder.autoPost.timezone
      : browserTimezone;

  const weekDays = useMemo(
    () => [
      { day: 1, label: t('monday_short', 'Mon') },
      { day: 2, label: t('tuesday_short', 'Tue') },
      { day: 3, label: t('wednesday_short', 'Wed') },
      { day: 4, label: t('thursday_short', 'Thu') },
      { day: 5, label: t('friday_short', 'Fri') },
      { day: 6, label: t('saturday_short', 'Sat') },
      { day: 0, label: t('sunday_short', 'Sun') },
    ],
    [t]
  );

  const toggleDay = useCallback(
    (day: number) => () => {
      setDays((prev) =>
        prev.includes(day) ? prev.filter((p) => p !== day) : [...prev, day]
      );
    },
    []
  );

  const save = useCallback(async () => {
    setSaving(true);
    const response = await fetch(`/media-folders/${folder.id}/auto-post`, {
      method: 'PUT',
      body: JSON.stringify({ enabled, days, time, timezone, content }),
    });
    setSaving(false);
    if (!response.ok) {
      toaster.show(
        await errorMessage(response, t('folder_auto_post_failed', 'Could not save the schedule')),
        'warning'
      );
      return;
    }
    onSaved();
    modals.closeCurrent();
  }, [fetch, folder.id, enabled, days, time, timezone, content, onSaved, modals, toaster, t]);

  return (
    <div className="flex flex-col gap-[16px]">
      <div className="text-textItemBlur text-[14px]">
        {t(
          'folder_auto_post_description',
          'Media added to this folder is added as a draft on its channels, one per slot of this schedule. Drafts are not published until you schedule them.'
        )}
      </div>
      {!folder.integrations.length && (
        <div className="text-[14px] text-red-400">
          {t(
            'folder_auto_post_no_channels',
            'This folder has no channels yet, link channels first.'
          )}
        </div>
      )}
      <label className="flex items-center gap-[10px] cursor-pointer">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
        />
        {t('folder_auto_post_enabled', 'Draft new media automatically')}
      </label>
      <div className="flex flex-col gap-[8px]">
        <div className="text-[14px]">{t('days', 'Days')}</div>
        <div className="flex gap-[6px] flex-wrap">
          {weekDays.map((p) => (
            <div
              key={p.day}
              onClick={toggleDay(p.day)}
              className={clsx(
                'cursor-pointer px-[12px] h-[34px] flex items-center rounded-[8px] border text-[14px]',
                days.includes(p.day)
                  ? 'bg-[#612BD3] border-[#612BD3] text-white'
                  : 'border-newColColor'
              )}
            >
              {p.label}
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-[8px]">
        <div className="text-[14px]">
          {t('time', 'Time')}{' '}
          <span className="text-textItemBlur text-[12px]">({timezone})</span>
        </div>
        <input
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          className="w-[140px] h-[44px] px-[14px] rounded-[8px] bg-newBgColorInner border border-newColColor text-[14px] outline-none"
        />
      </div>
      <div className="flex flex-col gap-[8px]">
        <div className="text-[14px]">
          {t('folder_auto_post_content', 'Post text')}{' '}
          <span className="text-textItemBlur text-[12px]">
            {t('folder_auto_post_name_hint', '{name} is replaced with the file name')}
          </span>
        </div>
        <textarea
          value={content}
          maxLength={5000}
          rows={5}
          onChange={(e) => setContent(e.target.value)}
          className="w-full p-[14px] rounded-[8px] bg-newBgColorInner border border-newColColor text-[14px] outline-none focus:border-[#612BD3]"
        />
      </div>
      <div className="flex justify-end">
        <Button onClick={save} loading={saving} disabled={enabled && !days.length}>
          {t('save', 'Save')}
        </Button>
      </div>
    </div>
  );
};

export const MoveToFolderModal: FC<{
  mediaIds: string[];
  current?: string | null;
  onMoved: () => void;
}> = ({ mediaIds, current, onMoved }) => {
  const t = useT();
  const fetch = useFetch();
  const modals = useModals();
  const toaster = useToaster();
  const { data: folders } = useMediaFolders();
  const [target, setTarget] = useState<string>(current || 'root');
  const [saving, setSaving] = useState(false);

  const options = useMemo(
    () =>
      (folders || [])
        .map((p) => ({ id: p.id, path: folderPath(folders!, p.id) }))
        .sort((a, b) => a.path.localeCompare(b.path)),
    [folders]
  );

  const move = useCallback(async () => {
    setSaving(true);
    const response = await fetch('/media-folders/move', {
      method: 'PUT',
      body: JSON.stringify({
        media: mediaIds,
        folderId: target === 'root' ? null : target,
      }),
    });
    setSaving(false);
    if (!response.ok) {
      toaster.show(
        await errorMessage(response, t('move_media_failed', 'Could not move the media')),
        'warning'
      );
      return;
    }
    onMoved();
    modals.closeCurrent();
  }, [fetch, mediaIds, target, onMoved, modals, toaster, t]);

  return (
    <div className="flex flex-col gap-[16px]">
      <select
        value={target}
        onChange={(e) => setTarget(e.target.value)}
        className="w-full h-[44px] px-[14px] rounded-[8px] bg-newBgColorInner border border-newColColor text-[14px] outline-none"
      >
        <option value="root">{t('no_folder', 'No folder')}</option>
        {options.map((p) => (
          <option key={p.id} value={p.id}>
            {p.path}
          </option>
        ))}
      </select>
      <div className="flex justify-end">
        <Button onClick={move} loading={saving}>
          {t('move', 'Move')}
        </Button>
      </div>
    </div>
  );
};

const FolderRow: FC<{
  folder: MediaFolderItem;
  folders: MediaFolderItem[];
  depth: number;
  selected: FolderSelection;
  expanded: string[];
  onSelect: (id: FolderSelection) => void;
  onToggle: (id: string) => void;
  onAction: (action: 'add' | 'rename' | 'channels' | 'autopost' | 'delete', folder: MediaFolderItem) => void;
}> = (props) => {
  const { folder, folders, depth, selected, expanded, onSelect, onToggle, onAction } = props;
  const t = useT();
  const children = folders.filter((p) => p.parentId === folder.id);
  const isOpen = expanded.includes(folder.id);

  return (
    <>
      <div
        className={clsx(
          'group/folder flex items-center gap-[4px] h-[34px] rounded-[6px] pe-[4px] cursor-pointer hover:bg-boxHover',
          selected === folder.id && 'bg-boxHover'
        )}
        style={{ paddingInlineStart: 4 + depth * 14 }}
        onClick={() => onSelect(folder.id)}
      >
        <div
          className={clsx(
            'w-[16px] text-center text-[10px] text-textItemBlur',
            !children.length && 'invisible'
          )}
          onClick={(e) => {
            e.stopPropagation();
            onToggle(folder.id);
          }}
        >
          {isOpen ? '▼' : '▶'}
        </div>
        <div className="flex-1 truncate text-[14px]">{folder.name}</div>
        {!!folder.integrations.length && (
          <div
            className="flex -space-x-[6px]"
            data-tooltip-id="tooltip"
            data-tooltip-content={folder.integrations.map((p) => p.name).join(', ')}
          >
            {folder.integrations.slice(0, 3).map((p) => (
              <img
                key={p.id}
                className="w-[16px] h-[16px] rounded-full border border-newBgColorInner"
                src={p.picture || '/no-picture.jpg'}
              />
            ))}
          </div>
        )}
        {folder.autoPost.enabled && (
          <div
            className="text-[12px] text-[#612BD3] group-hover/folder:hidden"
            data-tooltip-id="tooltip"
            data-tooltip-content={t('folder_auto_post_on', 'Auto post is on')}
          >
            ⏱
          </div>
        )}
        <div className="text-[12px] text-textItemBlur group-hover/folder:hidden">
          {folder.count}
        </div>
        <div className="hidden group-hover/folder:flex gap-[6px] text-[12px] text-textItemBlur">
          <span
            className="hover:text-newTextColor"
            data-tooltip-id="tooltip"
            data-tooltip-content={t('new_subfolder', 'New subfolder')}
            onClick={(e) => {
              e.stopPropagation();
              onAction('add', folder);
            }}
          >
            +
          </span>
          <span
            className="hover:text-newTextColor"
            data-tooltip-id="tooltip"
            data-tooltip-content={t('folder_channels', 'Channels')}
            onClick={(e) => {
              e.stopPropagation();
              onAction('channels', folder);
            }}
          >
            ⛓
          </span>
          <span
            className={clsx('hover:text-newTextColor', folder.autoPost.enabled && 'text-[#612BD3]')}
            data-tooltip-id="tooltip"
            data-tooltip-content={t('folder_auto_post', 'Auto post')}
            onClick={(e) => {
              e.stopPropagation();
              onAction('autopost', folder);
            }}
          >
            ⏱
          </span>
          <span
            className="hover:text-newTextColor"
            data-tooltip-id="tooltip"
            data-tooltip-content={t('rename', 'Rename')}
            onClick={(e) => {
              e.stopPropagation();
              onAction('rename', folder);
            }}
          >
            ✎
          </span>
          <span
            className="hover:text-red-500"
            data-tooltip-id="tooltip"
            data-tooltip-content={t('delete', 'Delete')}
            onClick={(e) => {
              e.stopPropagation();
              onAction('delete', folder);
            }}
          >
            ✕
          </span>
        </div>
      </div>
      {isOpen &&
        children.map((child) => (
          <FolderRow key={child.id} {...props} folder={child} depth={depth + 1} />
        ))}
    </>
  );
};

export const MediaFoldersSidebar: FC<{
  selected: FolderSelection;
  onSelect: (id: FolderSelection) => void;
  onChanged: () => void;
}> = ({ selected, onSelect, onChanged }) => {
  const t = useT();
  const fetch = useFetch();
  const modals = useModals();
  const toaster = useToaster();
  const { data: folders, mutate } = useMediaFolders();
  const [expanded, setExpanded] = useState<string[]>([]);

  // a folder opened from outside (e.g. the channel's folder) must be visible
  useEffect(() => {
    if (!folders || selected === 'all' || selected === 'root') {
      return;
    }
    const parents: string[] = [];
    let current = folders.find((p) => p.id === selected);
    while (current?.parentId) {
      parents.push(current.parentId);
      current = folders.find((p) => p.id === current!.parentId);
    }
    if (parents.length) {
      setExpanded((prev) => [...new Set([...prev, ...parents])]);
    }
  }, [folders, selected]);

  const toggle = useCallback((id: string) => {
    setExpanded((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  }, []);

  const createFolder = useCallback(
    (parent?: MediaFolderItem) => {
      modals.openModal({
        title: parent
          ? t('new_subfolder_in', 'New folder in {{name}}', { name: parent.name })
          : t('new_folder', 'New folder'),
        withCloseButton: true,
        children: (
          <FolderNameModal
            onSave={async (name) => {
              const response = await fetch('/media-folders', {
                method: 'POST',
                body: JSON.stringify({ name, parentId: parent?.id }),
              });
              if (!response.ok) {
                toaster.show(
                  await errorMessage(response, t('folder_save_failed', 'Could not save the folder')),
                  'warning'
                );
                return false;
              }
              if (parent) {
                setExpanded((prev) => [...new Set([...prev, parent.id])]);
              }
              await mutate();
              return true;
            }}
          />
        ),
      });
    },
    [modals, fetch, toaster, mutate, t]
  );

  const onAction = useCallback(
    async (action: 'add' | 'rename' | 'channels' | 'autopost' | 'delete', folder: MediaFolderItem) => {
      if (action === 'add') {
        createFolder(folder);
        return;
      }

      if (action === 'rename') {
        modals.openModal({
          title: t('rename_folder', 'Rename folder'),
          withCloseButton: true,
          children: (
            <FolderNameModal
              initial={folder.name}
              onSave={async (name) => {
                const response = await fetch(`/media-folders/${folder.id}`, {
                  method: 'PUT',
                  body: JSON.stringify({ name }),
                });
                if (!response.ok) {
                  toaster.show(
                    await errorMessage(response, t('folder_save_failed', 'Could not save the folder')),
                    'warning'
                  );
                  return false;
                }
                await mutate();
                return true;
              }}
            />
          ),
        });
        return;
      }

      if (action === 'autopost') {
        modals.openModal({
          title: t('folder_auto_post_title', 'Auto post from {{name}}', { name: folder.name }),
          withCloseButton: true,
          children: <FolderAutoPostModal folder={folder} onSaved={() => mutate()} />,
        });
        return;
      }

      if (action === 'channels') {
        modals.openModal({
          title: t('folder_channels_title', 'Channels for {{name}}', { name: folder.name }),
          withCloseButton: true,
          children: (
            <FolderChannelsModal
              folder={folder}
              folders={folders || []}
              onSaved={() => mutate()}
            />
          ),
        });
        return;
      }

      if (
        !(await deleteDialog(
          t(
            'delete_folder_confirm',
            'Delete {{name}} and its subfolders? The media inside is not deleted, it moves to the parent folder.',
            { name: folder.name }
          )
        ))
      ) {
        return;
      }
      const response = await fetch(`/media-folders/${folder.id}`, { method: 'DELETE' });
      if (!response.ok) {
        toaster.show(
          await errorMessage(response, t('folder_delete_failed', 'Could not delete the folder')),
          'warning'
        );
        return;
      }
      if (selected === folder.id) {
        onSelect(folder.parentId || 'all');
      }
      await mutate();
      onChanged();
    },
    [createFolder, modals, fetch, toaster, mutate, folders, selected, onSelect, onChanged, t]
  );

  const roots = (folders || []).filter((p) => !p.parentId);

  return (
    <div className="flex flex-col gap-[2px] w-[230px] min-w-[230px] pe-[12px] border-e border-newColColor overflow-y-auto mobile:hidden">
      <div
        className={clsx(
          'flex items-center h-[34px] px-[8px] rounded-[6px] cursor-pointer hover:bg-boxHover text-[14px]',
          selected === 'all' && 'bg-boxHover'
        )}
        onClick={() => onSelect('all')}
      >
        {t('all_media', 'All media')}
      </div>
      <div
        className={clsx(
          'flex items-center h-[34px] px-[8px] rounded-[6px] cursor-pointer hover:bg-boxHover text-[14px]',
          selected === 'root' && 'bg-boxHover'
        )}
        onClick={() => onSelect('root')}
      >
        {t('no_folder', 'No folder')}
      </div>
      <div className="h-[1px] bg-newColColor my-[6px]" />
      {roots.map((folder) => (
        <FolderRow
          key={folder.id}
          folder={folder}
          folders={folders || []}
          depth={0}
          selected={selected}
          expanded={expanded}
          onSelect={onSelect}
          onToggle={toggle}
          onAction={onAction}
        />
      ))}
      <div
        className="flex items-center h-[34px] px-[8px] rounded-[6px] cursor-pointer hover:bg-boxHover text-[14px] text-textItemBlur"
        onClick={() => createFolder()}
      >
        + {t('new_folder', 'New folder')}
      </div>
    </div>
  );
};

// phones have no room for the tree, they pick the folder from a list
export const MediaFoldersSelect: FC<{
  selected: FolderSelection;
  onSelect: (id: FolderSelection) => void;
}> = ({ selected, onSelect }) => {
  const t = useT();
  const { data: folders } = useMediaFolders();
  const options = useMemo(
    () =>
      (folders || [])
        .map((p) => ({ id: p.id, path: folderPath(folders!, p.id) }))
        .sort((a, b) => a.path.localeCompare(b.path)),
    [folders]
  );

  return (
    <select
      value={selected}
      onChange={(e) => onSelect(e.target.value)}
      className="hidden mobile:block w-full h-[44px] px-[14px] rounded-[8px] bg-newBgColorInner border border-newColColor text-[14px] outline-none"
    >
      <option value="all">{t('all_media', 'All media')}</option>
      <option value="root">{t('no_folder', 'No folder')}</option>
      {options.map((p) => (
        <option key={p.id} value={p.id}>
          {p.path}
        </option>
      ))}
    </select>
  );
};
