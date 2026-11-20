import React, { useState } from 'react';
import {
  Send,
  Smile,
  CornerDownRight,
  MessageSquare,
  Trash2,
  AtSign
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Comment } from '../../types';

interface CommentThreadProps {
  projectId: string;
  targetType: Comment['targetType'];
  targetId: string;
  title?: string;
}

export const CommentThread: React.FC<CommentThreadProps> = ({
  projectId,
  targetType,
  targetId,
  title = 'Discussion & Activity'
}) => {
  const {
    comments,
    addComment,
    toggleReaction,
    deleteComment,
    currentUser,
    users,
    isAdmin,
    isSuperAdmin
  } = useApp();

  const [newCommentText, setNewCommentText] = useState('');
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [showReactionPickerFor, setShowReactionPickerFor] = useState<string | null>(null);
  const [showMentionList, setShowMentionList] = useState(false);
  const [isPosting, setIsPosting] = useState(false);

  // Filter comments for this target
  const targetComments = comments.filter(
    (c) => c.projectId === projectId && c.targetType === targetType && c.targetId === targetId
  );

  // Group into root comments and their replies
  const rootComments = targetComments.filter((c) => !c.parentCommentId);
  const getReplies = (parentId: string) => targetComments.filter((c) => c.parentCommentId === parentId);

  const handleCommentTextChange = (val: string) => {
    setNewCommentText(val);
    const lastToken = val.split(/\s/).pop() || '';
    setShowMentionList(lastToken.startsWith('@'));
  };

  const insertMention = (handleName: string) => {
    const parts = newCommentText.split(/\s/);
    parts[parts.length - 1] = `@${handleName.replace(/\s+/g, '')}`;
    setNewCommentText(`${parts.join(' ')} `);
    setShowMentionList(false);
  };

  const handlePostRoot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim() || isPosting) return;

    setIsPosting(true);
    try {
      await addComment({
        projectId,
        targetType,
        targetId,
        content: newCommentText.trim(),
        parentCommentId: null
      });
      setNewCommentText('');
      setShowMentionList(false);
    } finally {
      setIsPosting(false);
    }
  };

  const handlePostReply = async (parentId: string) => {
    if (!replyText.trim() || isPosting) return;

    setIsPosting(true);
    try {
      await addComment({
        projectId,
        targetType,
        targetId,
        content: replyText.trim(),
        parentCommentId: parentId
      });
      setReplyText('');
      setReplyingToId(null);
    } finally {
      setIsPosting(false);
    }
  };

  const availableEmojis = ['👍', '❤️', '🚀', '👀', '🎉'];
  const mentionQuery = (newCommentText.split(/\s/).pop() || '').replace(/^@/, '').toLowerCase();
  const mentionCandidates = users
    .filter((u) => u.id !== currentUser?.id)
    .filter((u) => !mentionQuery || u.name.toLowerCase().includes(mentionQuery))
    .slice(0, 6);

  const renderCommentItem = (comment: Comment, isReply = false) => {
    const author = users.find((u) => u.id === comment.userId) || {
      name: 'Team Member',
      avatar: 'https://ui-avatars.com/api/?name=Member&background=0f172a&color=fff',
      role: 'member'
    };

    const canDelete = currentUser?.id === comment.userId || isAdmin || isSuperAdmin;
    const replies = getReplies(comment.id);

    return (
      <div key={comment.id} className={`group ${isReply ? 'ml-8 mt-2.5 pl-3 border-l-2 border-slate-200' : 'mt-4'}`}>
        <div className="flex items-start gap-2.5">
          <img
            src={author.avatar}
            alt={author.name}
            className="w-7 h-7 rounded-full object-cover shrink-0 border border-slate-200 mt-0.5"
            referrerPolicy="no-referrer"
          />

          <div className="flex-1 min-w-0">
            <div className="bg-slate-50/80 hover:bg-slate-50 border border-slate-200/80 rounded-xl p-3 transition-colors">
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="font-semibold text-slate-900">{author.name}</span>
                  <span className="text-slate-400">·</span>
                  <span className="text-[11px] text-slate-500 font-mono-tabular">
                    {new Date(comment.createdAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>

                <div className="flex items-center gap-1 relative opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={() => setShowReactionPickerFor(showReactionPickerFor === comment.id ? null : comment.id)}
                    className="p-1 text-slate-400 hover:text-slate-600 rounded hover:bg-slate-200/60 text-xs"
                    title="Add reaction"
                  >
                    <Smile className="w-3.5 h-3.5" />
                  </button>

                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => deleteComment(comment.id)}
                      className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 text-xs"
                      title="Delete comment"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {showReactionPickerFor === comment.id && (
                    <div className="absolute right-0 top-6 bg-white border border-slate-200 rounded-lg shadow-md p-1 flex items-center gap-1 z-30">
                      {availableEmojis.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => {
                            toggleReaction(comment.id, emoji);
                            setShowReactionPickerFor(null);
                          }}
                          className="hover:scale-125 p-1 text-sm transition-transform"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <p className="text-xs text-slate-800 whitespace-pre-wrap leading-relaxed">
                {comment.content}
              </p>

              {Object.keys(comment.reactions || {}).length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 mt-2 pt-2 border-t border-slate-200/60">
                  {Object.entries(comment.reactions).map(([emoji, userIds]) => {
                    const hasReacted = currentUser ? userIds.includes(currentUser.id) : false;
                    return (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => toggleReaction(comment.id, emoji)}
                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] border transition-colors ${
                          hasReacted
                            ? 'bg-blue-50 border-blue-200 text-blue-700'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        <span>{emoji}</span>
                        <span className="font-mono-tabular font-semibold text-[10px]">{userIds.length}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {!isReply && (
              <div className="mt-1 flex items-center gap-3 text-[11px] text-slate-500 pl-1">
                <button
                  type="button"
                  onClick={() => setReplyingToId(replyingToId === comment.id ? null : comment.id)}
                  className="font-medium hover:text-slate-800 transition-colors flex items-center gap-1"
                >
                  <CornerDownRight className="w-3 h-3" />
                  Reply
                </button>
                {replies.length > 0 && (
                  <span>{replies.length} {replies.length === 1 ? 'reply' : 'replies'}</span>
                )}
              </div>
            )}

            {replyingToId === comment.id && (
              <div className="mt-2.5 ml-4 pl-3 border-l-2 border-slate-200 flex items-center gap-2">
                <input
                  type="text"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder={`Reply to ${author.name}...`}
                  className="flex-1 text-xs bg-white border border-slate-200 rounded-lg px-3 py-1.5 outline-hidden focus:border-slate-400"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handlePostReply(comment.id);
                    }
                  }}
                />
                <button
                  type="button"
                  disabled={isPosting || !replyText.trim()}
                  onClick={() => handlePostReply(comment.id)}
                  className="p-1.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 text-xs shrink-0 disabled:opacity-40"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setReplyingToId(null);
                    setReplyText('');
                  }}
                  className="text-xs text-slate-400 hover:text-slate-600"
                >
                  Cancel
                </button>
              </div>
            )}

            {replies.map((reply) => renderCommentItem(reply, true))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="mt-6 pt-5 border-t border-slate-200">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
          <MessageSquare className="w-3.5 h-3.5 text-slate-500" />
          {title} ({targetComments.length})
        </h3>
      </div>

      {/* Root Comments List */}
      <div className="space-y-3 mb-4">
        {rootComments.length === 0 ? (
          <p className="text-xs text-slate-400 italic py-2">
            No comments yet. Start the conversation below.
          </p>
        ) : (
          rootComments.map((c) => renderCommentItem(c))
        )}
      </div>

      {/* Main Comment Box */}
      <form onSubmit={handlePostRoot} className="relative mt-4">
        {showMentionList && mentionCandidates.length > 0 && (
          <div className="mb-2 ml-9 bg-white border border-slate-200 rounded-lg shadow-md p-1.5 flex flex-wrap gap-1 z-20">
            <span className="text-[10px] font-semibold text-slate-400 uppercase px-1.5 py-1 flex items-center gap-1">
              <AtSign className="w-3 h-3" /> Mention:
            </span>
            {mentionCandidates.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => insertMention(u.firstName || u.name)}
                className="px-2 py-1 text-xs bg-slate-50 hover:bg-slate-100 rounded border border-slate-200 text-slate-800 font-medium"
              >
                {u.name}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-start gap-2.5">
          <img
            src={currentUser?.avatar || 'https://ui-avatars.com/api/?name=User'}
            alt={currentUser?.name || 'User'}
            className="w-7 h-7 rounded-full object-cover shrink-0 border border-slate-200 mt-1"
            referrerPolicy="no-referrer"
          />
          <div className="flex-1 border border-slate-200 rounded-xl bg-white focus-within:border-slate-400 transition-colors shadow-2xs overflow-hidden">
            <textarea
              value={newCommentText}
              onChange={(e) => handleCommentTextChange(e.target.value)}
              placeholder="Write a comment, remark, or type @ to mention a teammate... (⌘+Enter to submit)"
              rows={2}
              className="w-full text-xs p-3 outline-hidden resize-none text-slate-800 placeholder:text-slate-400"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  handlePostRoot(e);
                }
              }}
            />
            <div className="px-3 py-2 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3 text-[11px] text-slate-400">
                <span>
                  Press <kbd className="font-mono-tabular px-1 bg-white border rounded">⌘+Enter</kbd> to post
                </span>
                <button
                  type="button"
                  onClick={() => handleCommentTextChange(newCommentText + (newCommentText.endsWith(' ') || !newCommentText ? '@' : ' @'))}
                  className="text-slate-600 hover:text-slate-900 font-medium flex items-center gap-0.5"
                >
                  <AtSign className="w-3 h-3" />
                  <span>Mention</span>
                </button>
              </div>
              <button
                type="submit"
                disabled={isPosting || !newCommentText.trim()}
                className="flex items-center gap-1 px-3 py-1 bg-slate-900 text-white rounded-lg text-xs font-medium hover:bg-slate-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Send className="w-3 h-3" />
                <span>{isPosting ? 'Posting...' : 'Post Comment'}</span>
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};
