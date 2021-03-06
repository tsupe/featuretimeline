import { createSelector } from 'reselect';
import { WorkItemLink, WorkItem } from 'TFS/WorkItemTracking/Contracts';
import { backlogConfigurationForProjectSelector } from '../modules/backlogconfiguration/backlogconfigurationselector';
import { BacklogConfiguration, BacklogLevelConfiguration } from 'TFS/Work/Contracts';
import { getEpicHierarchyLinks, pagedWorkItemsMapSelector } from './workItemSelector';
import { outOfScopeWorkItems } from './uiStateSelector';
export interface IEpicTree {
    parentToChildrenMap: IDictionaryNumberTo<number[]>;
    childToParentMap: IDictionaryNumberTo<number>;
}
const rawEpicTreeSelector = createSelector(
    getEpicHierarchyLinks,
    outOfScopeWorkItems,
    createRawEpicTree);
export function createRawEpicTree(
    links: WorkItemLink[],
    outOfScopeWorkItems: WorkItem[]
) {
    const epicTree: IEpicTree = {
        parentToChildrenMap: {},
        childToParentMap: {}
    };
    links = links || [];
    const outOfScopeWorkItemsSet = new Set();
    outOfScopeWorkItems.forEach(w => outOfScopeWorkItemsSet.add(w.id));

    // target is child and source is parent
    links.reduce((epicTree, link) => {
        const childId = link.target ? link.target.id : 0;
        const parentId = link.source ? link.source.id : 0;
        // Exclude work items not in iterations subscribed by the team
        if (!outOfScopeWorkItemsSet.has(childId) && !outOfScopeWorkItemsSet.has(parentId)) {
            const { childToParentMap, parentToChildrenMap } = epicTree;
            childToParentMap[childId] = parentId;
            if (!parentToChildrenMap[parentId]) {
                parentToChildrenMap[parentId] = [];
            }
            parentToChildrenMap[parentId].push(childId);
        }
        return epicTree;
    }, epicTree);
    return epicTree;
}
export const normalizedEpicTreeSelector = createSelector(backlogConfigurationForProjectSelector, pagedWorkItemsMapSelector, rawEpicTreeSelector as any, createNormalizedEpicTree);
/**
 * Gets a map of WorkItemTypeName to its rank in backlog configuration
 */
function getWorkItemTypeRankMap(backlogConfiguration: BacklogConfiguration): IDictionaryStringTo<number> {

    if (!backlogConfiguration) {
        return {};
    }

    const result: IDictionaryStringTo<number> = {};
    const processBacklogLevel = (backlogLevel: BacklogLevelConfiguration) => {
        backlogLevel.workItemTypes.forEach(wit => result[wit.name] = backlogLevel.rank);
    };
    processBacklogLevel(backlogConfiguration.requirementBacklog);
    backlogConfiguration.portfolioBacklogs.forEach(processBacklogLevel);
    return result;
}
/**
 * Normalizes the epic tree where it removes Story/Story hierarchy,
 * also removes any children not part of backlog level hierarchy
 */
export function createNormalizedEpicTree(backlogConfiguration: BacklogConfiguration, workItemsMap: IDictionaryNumberTo<WorkItem>, epicTree: IEpicTree): IEpicTree {
    const { parentToChildrenMap = {} } = epicTree;
    const result: IEpicTree = {
        parentToChildrenMap: {},
        childToParentMap: {}
    };

    if (Object.keys(workItemsMap).length === 0) {
        return result;
    }

    const witRankMap = getWorkItemTypeRankMap(backlogConfiguration);
    const normalizeChild = (grandParentId: number, parentId: number, parentWitRank: number) => {
        let children: number[] = parentToChildrenMap[parentId];
        if (children && children.length > 0) {
            children.forEach(childId => {
                const childWitRank = witRankMap[workItemsMap[childId].fields["System.WorkItemType"]];
                // exclude if child work item type is not part of backlog level hierarchy
                if (childWitRank) {
                    result.parentToChildrenMap[childId] = [];
                    // if child and parent are of same rank then make child the sibling of parent
                    // note we deliberately don't handle story => feature/epic hierarchy where feature/epic is child of story
                    if (childWitRank === parentWitRank) {
                        result.parentToChildrenMap[grandParentId].push(childId);
                        result.childToParentMap[childId] = grandParentId;
                        normalizeChild(grandParentId, /*parentId*/ childId, /*parentWitRank*/ childWitRank);
                    }
                    else {
                        result.parentToChildrenMap[parentId].push(childId);
                        result.childToParentMap[childId] = parentId;
                        normalizeChild(/*grandParentId*/ parentId, /*parentId*/ childId, /*parentWitRank*/ childWitRank);
                    }
                }
            });
        }
    };
    result.parentToChildrenMap[0] = [];
    normalizeChild(/*grandParentId*/ 0, /*parentId*/ 0, /*parentWitRank*/ -1);
    return result;
}