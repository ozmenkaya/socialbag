'use client';

import React, { FC, useCallback, useState } from 'react';
import useSWR from 'swr';
import clsx from 'clsx';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useModals } from '@gitroom/frontend/components/layout/new-modal';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { deleteDialog } from '@gitroom/react/helpers/delete.dialog';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { Button } from '@gitroom/react/form/button';
import {
  errorMessage,
  folderPath,
  useFolderIntegrationList,
  useMediaFolders,
} from '@gitroom/frontend/components/media/media.folders';
import {
  ProjectItem,
  useProjects,
} from '@gitroom/frontend/components/projects/use.projects';
import { showMediaBox } from '@gitroom/frontend/components/media/media.component';

// the colors of the template designs when the project has none
const DEFAULT_PRIMARY = '#1F2A44';
const DEFAULT_ACCENT = '#C9A227';

const useDriveInfo = () => {
  const fetch = useFetch();
  const load = useCallback(async () => {
    return (await fetch('/projects/drive')).json();
  }, [fetch]);

  return useSWR<{ enabled: boolean; email: string | null }>('projects-drive', load, {
    revalidateOnFocus: false,
  });
};

const SourceStatus: FC<{ source: ProjectItem['sources'][number] }> = ({ source }) => {
  const t = useT();
  const label = {
    pending: t('source_pending', 'Waiting'),
    syncing: t('source_syncing', 'Listing files...'),
    ready: t('source_ready', '{{count}} files', { count: source.fileCount }),
    no_access: t('source_no_access', 'Not shared'),
    error: t('source_error', 'Error'),
  }[source.status];

  return (
    <span
      className={clsx(
        'text-[11px] px-[6px] py-[1px] rounded-[4px] shrink-0',
        source.status === 'ready' && 'bg-[#12B76A]/20 text-[#12B76A]',
        (source.status === 'no_access' || source.status === 'error') &&
          'bg-[#F97066]/20 text-[#F97066]',
        (source.status === 'pending' || source.status === 'syncing') && 'bg-boxHover'
      )}
      data-tooltip-id="tooltip"
      data-tooltip-content={
        source.error ||
        (source.sharedBy
          ? t('source_shared_by', 'Shared by {{email}}', { email: source.sharedBy })
          : undefined)
      }
    >
      {label}
    </span>
  );
};

const inputClass =
  'w-full px-[14px] rounded-[8px] bg-newBgColorInner border border-newColColor text-[14px] outline-none focus:border-[#612BD3]';

const ProjectModal: FC<{
  project?: ProjectItem;
  onSaved: () => void;
}> = ({ project, onSaved }) => {
  const t = useT();
  const fetch = useFetch();
  const modals = useModals();
  const toaster = useToaster();
  const { data: integrations, isLoading: integrationsLoading } = useFolderIntegrationList();
  const { data: folders, isLoading: foldersLoading } = useMediaFolders();
  const [name, setName] = useState(project?.name || '');
  const [description, setDescription] = useState(project?.description || '');
  const [channels, setChannels] = useState<string[]>(
    project?.integrations.map((p) => p.id) || []
  );
  const [selectedFolders, setSelectedFolders] = useState<string[]>(
    project?.folders.map((p) => p.id) || []
  );
  const [drive, setDrive] = useState(
    (project?.sources || []).map((p) => p.url).join('\n')
  );
  const [logo, setLogo] = useState<{ id: string; path: string } | undefined>(
    project?.brand.logoId && project.brand.logoPath
      ? { id: project.brand.logoId, path: project.brand.logoPath }
      : undefined
  );
  // the defaults are only shown, a color is saved once it is picked
  const [primary, setPrimary] = useState(project?.brand.primary || '');
  const [accent, setAccent] = useState(project?.brand.accent || '');
  const [font, setFont] = useState(project?.brand.font || '');
  const [contact, setContact] = useState(project?.brand.contact || '');
  const [saving, setSaving] = useState(false);

  const chooseLogo = useCallback(() => {
    showMediaBox((media) => {
      setLogo({ id: media.id, path: media.path });
    });
  }, []);

  const toggle = useCallback(
    (set: React.Dispatch<React.SetStateAction<string[]>>, id: string) => () => {
      set((prev) =>
        prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
      );
    },
    []
  );

  const save = useCallback(async () => {
    if (!name.trim()) {
      return;
    }
    setSaving(true);
    const response = await fetch(project ? `/projects/${project.id}` : '/projects', {
      method: project ? 'PUT' : 'POST',
      body: JSON.stringify({
        name: name.trim(),
        description,
        integrations: channels,
        folders: selectedFolders,
        driveFolders: drive
          .split('\n')
          .map((p) => p.trim())
          .filter((p) => p),
        brand: {
          ...(logo ? { logoId: logo.id } : {}),
          ...(primary ? { primary } : {}),
          ...(accent ? { accent } : {}),
          ...(font ? { font } : {}),
          contact,
        },
      }),
    });
    setSaving(false);
    if (!response.ok) {
      toaster.show(
        await errorMessage(response, t('project_save_failed', 'Could not save the project')),
        'warning'
      );
      return;
    }
    onSaved();
    modals.closeCurrent();
  }, [fetch, project, name, description, channels, selectedFolders, drive, logo, primary, accent, font, contact, onSaved, modals, toaster, t]);

  return (
    <div className="flex flex-col gap-[16px]">
      <div className="flex flex-col gap-[8px]">
        <div className="text-[14px]">{t('project_name', 'Project name')}</div>
        <input
          autoFocus={true}
          value={name}
          maxLength={100}
          onChange={(e) => setName(e.target.value)}
          className={`${inputClass} h-[44px]`}
        />
      </div>
      <div className="flex flex-col gap-[8px]">
        <div className="text-[14px]">{t('project_description', 'Description')}</div>
        <textarea
          value={description}
          maxLength={2000}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t(
            'project_description_placeholder',
            'What the project is, its location, its audience...'
          )}
          className={`${inputClass} min-h-[80px] py-[10px]`}
        />
      </div>
      <div className="flex flex-col gap-[8px]">
        <div className="text-[14px]">{t('project_channels', 'Channels')}</div>
        {integrationsLoading && (
          <div className="text-[13px] text-textItemBlur">{t('loading', 'Loading...')}</div>
        )}
        <div className="flex flex-col gap-[4px] max-h-[200px] overflow-y-auto">
          {(integrations || [])
            // a disabled channel stays listed while linked, so it can be unlinked
            .filter((p) => !p.disabled || channels.includes(p.id))
            .map((p) => (
              <label
                key={p.id}
                className={`flex items-center gap-[10px] cursor-pointer p-[6px] rounded-[8px] hover:bg-boxHover ${
                  p.disabled ? 'opacity-50' : ''
                }`}
              >
                <input
                  type="checkbox"
                  checked={channels.includes(p.id)}
                  onChange={toggle(setChannels, p.id)}
                />
                <img
                  className="w-[24px] h-[24px] rounded-full"
                  src={p.picture || '/no-picture.jpg'}
                />
                <div className="flex-1">{p.name}</div>
                <div className="text-[12px] text-textItemBlur">{p.identifier}</div>
              </label>
            ))}
        </div>
      </div>
      <div className="flex flex-col gap-[8px]">
        <div className="text-[14px]">{t('project_folders', 'Media folders')}</div>
        {foldersLoading ? (
          <div className="text-[13px] text-textItemBlur">{t('loading', 'Loading...')}</div>
        ) : !folders?.length ? (
          <div className="text-[13px] text-textItemBlur">
            {t('project_no_folders', 'Create folders in the media library to link them here.')}
          </div>
        ) : (
          <div className="flex flex-col gap-[4px] max-h-[200px] overflow-y-auto">
            {[...folders]
              .sort((a, b) => folderPath(folders, a.id).localeCompare(folderPath(folders, b.id)))
              .map((p) => (
                <label
                  key={p.id}
                  className="flex items-center gap-[10px] cursor-pointer p-[6px] rounded-[8px] hover:bg-boxHover"
                >
                  <input
                    type="checkbox"
                    checked={selectedFolders.includes(p.id)}
                    onChange={toggle(setSelectedFolders, p.id)}
                  />
                  <div className="flex-1">{folderPath(folders, p.id)}</div>
                </label>
              ))}
          </div>
        )}
      </div>
      <div className="flex flex-col gap-[8px]">
        <div className="text-[14px]">{t('project_drive_folders', 'Google Drive folders')}</div>
        <textarea
          value={drive}
          onChange={(e) => setDrive(e.target.value)}
          placeholder="https://drive.google.com/drive/folders/..."
          className={`${inputClass} min-h-[70px] py-[10px]`}
        />
        <div className="text-[12px] text-textItemBlur">
          {t(
            'project_drive_hint',
            'One folder link per line. The raw material of the project (photos, videos, floor plans, documents) is read from these folders by the archive.'
          )}
        </div>
      </div>
      <div className="flex flex-col gap-[8px]">
        <div className="text-[14px]">{t('project_brand', 'Brand of the designs')}</div>
        <div className="text-[12px] text-textItemBlur">
          {t(
            'project_brand_hint',
            'The template designs of this project put its logo, colors and contact line over the real photos.'
          )}
        </div>
        <div className="flex items-center gap-[12px]">
          <div
            className="w-[120px] h-[60px] rounded-[8px] border border-newColColor flex items-center justify-center overflow-hidden cursor-pointer bg-boxHover"
            onClick={chooseLogo}
          >
            {logo ? (
              <img src={logo.path} className="max-w-full max-h-full object-contain" />
            ) : (
              <span className="text-[12px] text-textItemBlur">{t('choose_logo', 'Choose logo')}</span>
            )}
          </div>
          {!!logo && (
            <span
              className="text-[13px] cursor-pointer text-textItemBlur hover:text-[#F97066]"
              onClick={() => setLogo(undefined)}
            >
              {t('remove', 'Remove')}
            </span>
          )}
          <div className="text-[12px] text-textItemBlur flex-1">
            {t('logo_hint', 'A PNG with a transparent background fits best.')}
          </div>
        </div>
        <div className="flex items-center gap-[16px] flex-wrap">
          <label className="flex items-center gap-[8px] text-[13px] cursor-pointer">
            <input
              type="color"
              value={primary || DEFAULT_PRIMARY}
              onChange={(e) => setPrimary(e.target.value)}
              className="w-[32px] h-[32px] cursor-pointer bg-transparent"
            />
            {t('brand_primary', 'Main color')}
          </label>
          <label className="flex items-center gap-[8px] text-[13px] cursor-pointer">
            <input
              type="color"
              value={accent || DEFAULT_ACCENT}
              onChange={(e) => setAccent(e.target.value)}
              className="w-[32px] h-[32px] cursor-pointer bg-transparent"
            />
            {t('brand_accent', 'Accent color')}
          </label>
          <select
            value={font || 'modern'}
            onChange={(e) => setFont(e.target.value as 'modern' | 'elegant')}
            className={`${inputClass} h-[36px] !w-auto`}
          >
            <option value="modern">{t('font_modern', 'Modern (Montserrat)')}</option>
            <option value="elegant">{t('font_elegant', 'Elegant (Playfair Display)')}</option>
          </select>
        </div>
        <input
          value={contact}
          maxLength={120}
          onChange={(e) => setContact(e.target.value)}
          placeholder={t('brand_contact_placeholder', 'Contact line: phone · website')}
          className={`${inputClass} h-[44px]`}
        />
      </div>
      <div className="flex justify-end">
        <Button onClick={save} loading={saving} disabled={!name.trim()}>
          {t('save', 'Save')}
        </Button>
      </div>
    </div>
  );
};

// how a customer gives the archive access to a Drive folder
const DriveGuide: FC<{
  email: string | null;
  connected: boolean;
  onCopy: () => void;
}> = ({ email, connected, onCopy }) => {
  const t = useT();
  const [open, setOpen] = useState<boolean | undefined>(undefined);
  const shown = open ?? !connected;

  if (!email) {
    return (
      <div className="p-[12px] rounded-[8px] border border-newColColor text-[13px] text-textItemBlur">
        {t(
          'drive_not_configured',
          'Google Drive is not connected on this server yet: the Drive folders are saved, their files are listed once it is.'
        )}
      </div>
    );
  }

  const steps = [
    t(
      'drive_step_share',
      'In Google Drive, right click the folder of the project and choose Share.'
    ),
    t(
      'drive_step_viewer',
      'Add the address above as Viewer and send. Drive may say it can not email that address: the folder is shared anyway.'
    ),
    t(
      'drive_step_link',
      'Copy the link of the folder (Share > Copy link, or the address bar while the folder is open).'
    ),
    t(
      'drive_step_project',
      'Here, open the project with Edit, paste the link in Google Drive folders and save: its files are listed in a few minutes (Sync lists them again later).'
    ),
  ];

  return (
    <div className="flex flex-col gap-[12px] p-[16px] rounded-[8px] border border-newColColor text-[13px]">
      <div className="flex items-center justify-between gap-[12px]">
        <div className="text-[14px] font-[600]">
          {t('drive_guide_title', 'Connect a Google Drive folder')}
        </div>
        <span
          className="cursor-pointer text-textItemBlur hover:text-newTextColor shrink-0"
          onClick={() => setOpen(!shown)}
        >
          {shown ? t('hide', 'Hide') : t('show_how', 'Show how')}
        </span>
      </div>
      <div className="flex items-center gap-[10px] flex-wrap">
        <span className="text-textItemBlur">
          {t('drive_share_with', 'Share the Drive folders of the projects as Viewer with:')}
        </span>
        <span className="font-[600] break-all px-[8px] py-[2px] rounded-[4px] bg-boxHover">
          {email}
        </span>
        <span className="cursor-pointer text-[#612BD3] hover:underline" onClick={onCopy}>
          {t('copy', 'Copy')}
        </span>
      </div>
      {shown && (
        <>
          <ol className="flex flex-col gap-[6px] list-decimal ps-[20px] text-textItemBlur">
            {steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <div className="text-[12px] text-textItemBlur">
            {t(
              'drive_guide_note',
              'Only the shared folder and its subfolders are visible, nothing else of the Drive. The files stay in Drive: only their details are kept here, and a photo or video is copied into the media library when it is used. Removing the share in Drive stops the access.'
            )}
          </div>
        </>
      )}
    </div>
  );
};

export const ProjectsComponent = () => {
  const t = useT();
  const fetch = useFetch();
  const modals = useModals();
  const toaster = useToaster();
  const { data, isLoading, mutate } = useProjects();
  const { data: drive } = useDriveInfo();

  const sync = useCallback(
    (project: ProjectItem) => async () => {
      const response = await fetch(`/projects/${project.id}/sync`, { method: 'POST' });
      if (!response.ok) {
        toaster.show(
          await errorMessage(response, t('project_sync_failed', 'Could not sync the project')),
          'warning'
        );
        return;
      }
      mutate();
    },
    [fetch, mutate, toaster, t]
  );

  const copyEmail = useCallback(async () => {
    if (drive?.email) {
      await navigator.clipboard.writeText(drive.email);
      toaster.show(t('copied', 'Copied'), 'success');
    }
  }, [drive, toaster, t]);

  const open = useCallback(
    (project?: ProjectItem) => () => {
      modals.openModal({
        title: project
          ? t('edit_project', 'Edit {{name}}', { name: project.name })
          : t('new_project', 'New project'),
        withCloseButton: true,
        children: <ProjectModal project={project} onSaved={() => mutate()} />,
      });
    },
    [modals, mutate, t]
  );

  const remove = useCallback(
    (project: ProjectItem) => async () => {
      if (
        !(await deleteDialog(
          t(
            'delete_project_confirm',
            'Delete {{name}}? Its channels, folders and media stay, only the project is removed.',
            { name: project.name }
          )
        ))
      ) {
        return;
      }

      const response = await fetch(`/projects/${project.id}`, { method: 'DELETE' });
      if (!response.ok) {
        toaster.show(
          await errorMessage(response, t('project_delete_failed', 'Could not delete the project')),
          'warning'
        );
        return;
      }
      mutate();
    },
    [fetch, mutate, toaster, t]
  );

  return (
    <div className="bg-newBgColorInner p-[20px] flex flex-1 flex-col gap-[20px]">
      <div className="flex items-center justify-between gap-[12px]">
        <div className="text-textItemBlur text-[14px]">
          {t(
            'projects_description',
            'Group the channels, media folders and raw material of each project of this customer.'
          )}
        </div>
        <Button onClick={open()}>{t('new_project', 'New project')}</Button>
      </div>
      {!!drive && (
        <DriveGuide
          email={drive.email}
          // open until a folder of this customer was listed once
          connected={!!data?.some((p) => p.sources.some((s) => s.status === 'ready'))}
          onCopy={copyEmail}
        />
      )}
      {isLoading ? (
        <div className="text-textItemBlur">{t('loading', 'Loading...')}</div>
      ) : !data?.length ? (
        <div className="text-textItemBlur">{t('no_projects', 'No projects yet')}</div>
      ) : (
        <div className="grid grid-cols-3 tablet:grid-cols-2 mobile:!grid-cols-1 gap-[12px]">
          {data.map((project) => (
            <div
              key={project.id}
              className="flex flex-col gap-[12px] p-[16px] rounded-[8px] border border-newColColor bg-newBgColor"
            >
              <div className="flex items-start justify-between gap-[8px]">
                <div className="text-[16px] font-[600] break-words min-w-0">{project.name}</div>
                <div className="flex gap-[10px] text-[13px] text-textItemBlur shrink-0">
                  <span className="cursor-pointer hover:text-newTextColor" onClick={open(project)}>
                    {t('edit', 'Edit')}
                  </span>
                  <span className="cursor-pointer hover:text-[#F97066]" onClick={remove(project)}>
                    {t('delete', 'Delete')}
                  </span>
                </div>
              </div>
              {!!project.description && (
                <div className="text-[13px] text-textItemBlur whitespace-pre-wrap line-clamp-3">
                  {project.description}
                </div>
              )}
              <div className="flex items-center gap-[6px] flex-wrap">
                {project.integrations.map((p) => (
                  <img
                    key={p.id}
                    className="w-[24px] h-[24px] rounded-full"
                    src={p.picture || '/no-picture.jpg'}
                    data-tooltip-id="tooltip"
                    data-tooltip-content={p.name}
                  />
                ))}
                {!project.integrations.length && (
                  <div className="text-[12px] text-textItemBlur">
                    {t('project_no_channels', 'No channels')}
                  </div>
                )}
              </div>
              {(!!project.brand.logoPath || !!project.brand.primary) && (
                <div className="flex items-center gap-[8px]">
                  {!!project.brand.logoPath && (
                    <img
                      src={project.brand.logoPath}
                      className="h-[24px] max-w-[80px] object-contain"
                    />
                  )}
                  {[project.brand.primary, project.brand.accent]
                    .filter((p) => p)
                    .map((color) => (
                      <span
                        key={color}
                        className="w-[16px] h-[16px] rounded-full border border-newColColor"
                        style={{ background: color }}
                      />
                    ))}
                </div>
              )}
              <div className="flex gap-[6px] flex-wrap">
                {project.folders.map((p) => (
                  <div
                    key={p.id}
                    className="text-[12px] px-[8px] py-[2px] rounded-[4px] bg-boxHover"
                  >
                    {p.name}
                  </div>
                ))}
              </div>
              {!!project.sources.length && (
                <div className="flex flex-col gap-[4px]">
                  {project.sources.map((p) => (
                    <div key={p.id} className="flex items-center gap-[8px] min-w-0">
                      <a
                        href={p.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[12px] text-textItemBlur hover:text-newTextColor truncate"
                      >
                        {p.name || `${t('drive_folder', 'Drive folder')} · ${p.externalId}`}
                      </a>
                      <SourceStatus source={p} />
                    </div>
                  ))}
                  <div className="flex items-center justify-between gap-[8px] text-[12px]">
                    <span className="text-textItemBlur">
                      {[
                        ['image', t('files_images', '{{count}} photos', { count: project.files.image })],
                        ['video', t('files_videos', '{{count}} videos', { count: project.files.video })],
                        ['document', t('files_documents', '{{count}} documents', { count: project.files.document })],
                      ]
                        .filter(([kind]) => project.files[kind])
                        .map(([, label]) => label)
                        .join(' · ')}
                    </span>
                    {!!drive?.email && (
                      <span
                        className={clsx(
                          'shrink-0',
                          project.sources.some((s) => s.status === 'syncing')
                            ? 'text-textItemBlur'
                            : 'cursor-pointer text-[#612BD3] hover:underline'
                        )}
                        onClick={
                          project.sources.some((s) => s.status === 'syncing')
                            ? undefined
                            : sync(project)
                        }
                      >
                        {t('sync_now', 'Sync')}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
