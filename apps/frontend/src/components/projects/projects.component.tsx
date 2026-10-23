'use client';

import React, { FC, useCallback, useState } from 'react';
import useSWR from 'swr';
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

export interface ProjectItem {
  id: string;
  name: string;
  description: string;
  integrations: {
    id: string;
    name: string;
    picture?: string;
    providerIdentifier: string;
  }[];
  folders: { id: string; name: string }[];
  sources: { id: string; type: string; externalId: string; url: string }[];
}

export const useProjects = () => {
  const fetch = useFetch();
  const load = useCallback(async () => {
    return (await fetch('/projects')).json();
  }, [fetch]);

  return useSWR<ProjectItem[]>('projects', load);
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
  const [saving, setSaving] = useState(false);

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
  }, [fetch, project, name, description, channels, selectedFolders, drive, onSaved, modals, toaster, t]);

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
      <div className="flex justify-end">
        <Button onClick={save} loading={saving} disabled={!name.trim()}>
          {t('save', 'Save')}
        </Button>
      </div>
    </div>
  );
};

export const ProjectsComponent = () => {
  const t = useT();
  const fetch = useFetch();
  const modals = useModals();
  const toaster = useToaster();
  const { data, isLoading, mutate } = useProjects();

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
                <div className="flex flex-col gap-[2px]">
                  {project.sources.map((p) => (
                    <a
                      key={p.id}
                      href={p.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[12px] text-textItemBlur hover:text-newTextColor truncate"
                    >
                      {t('drive_folder', 'Drive folder')} · {p.externalId}
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
