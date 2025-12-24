"use client"

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useUser } from '@clerk/nextjs';
import { useOrganization } from '@/contexts/OrganizationContext';
import { Heart, MessageCircle, Repeat, Eye, Calendar, ExternalLink, Image, Video, FileText, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Post {
  id: string;
  urn: string;
  author: string;
  createdAt: number;
  lastModifiedAt: number;
  visibility: string;
  textContent: string;
  fullText: string;
  media: Array<{
    type: 'image' | 'video' | 'article';
    url?: string;
    title?: string;
    description?: string;
    thumbnail?: string;
  }>;
  metrics: {
    likes: number;
    comments: number;
    reposts: number;
    impressions: number;
  };
  lifecycleState: string;
  publishedAt: number;
  scheduledAt?: number | null;
  distributionTarget?: any;
}

interface PostModalProps {
  post: Post;
  isOpen: boolean;
  onClose: () => void;
}

const PostModal: React.FC<PostModalProps> = ({ post, isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card text-foreground rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-card border-b border-border p-4 flex justify-between items-center">
          <h2 className="text-xl font-semibold">Post Details</h2>
          <Button variant="ghost" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            ✕
          </Button>
        </div>
        
        <div className="p-6">
          <div className="mb-4 text-sm text-muted-foreground">
            {formatDistanceToNow(new Date(post.publishedAt || post.createdAt), { addSuffix: true })}
          </div>

          <div className="prose max-w-none mb-6">
            <p className="whitespace-pre-wrap">{post.fullText}</p>
          </div>

          {post.media.length > 0 && (
            <div className="space-y-4 mb-6">
              {post.media.map((item, index) => (
                <div key={index} className="border border-border rounded-lg overflow-hidden">
                  {item.type === 'image' && (
                    <div className="bg-muted p-2">
                      <Image className="w-5 h-5 inline mr-2" />
                      <span>Image attachment</span>
                    </div>
                  )}
                  {item.type === 'video' && (
                    <div className="bg-muted p-2">
                      <Video className="w-5 h-5 inline mr-2" />
                      <span>Video attachment</span>
                    </div>
                  )}
                  {item.type === 'article' && (
                    <div className="p-4">
                      <FileText className="w-5 h-5 inline mr-2" />
                      <h3 className="font-medium inline">{item.title}</h3>
                      {item.description && <p className="text-sm text-muted-foreground mt-2">{item.description}</p>}
                      {item.url && (
                        <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline mt-2 inline-block">
                          <ExternalLink className="w-4 h-4 inline mr-1" />
                          View article
                        </a>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-4 gap-4 p-4 bg-muted rounded-lg">
            <div className="text-center">
              <div className="flex items-center justify-center text-foreground mb-1">
                <Heart className="w-5 h-5 mr-1" />
                <span className="font-semibold">{post.metrics.likes.toLocaleString()}</span>
              </div>
              <div className="text-xs text-muted-foreground">Likes</div>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center text-foreground mb-1">
                <MessageCircle className="w-5 h-5 mr-1" />
                <span className="font-semibold">{post.metrics.comments.toLocaleString()}</span>
              </div>
              <div className="text-xs text-muted-foreground">Comments</div>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center text-foreground mb-1">
                <Repeat className="w-5 h-5 mr-1" />
                <span className="font-semibold">{post.metrics.reposts.toLocaleString()}</span>
              </div>
              <div className="text-xs text-muted-foreground">Reposts</div>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center text-foreground mb-1">
                <Eye className="w-5 h-5 mr-1" />
                <span className="font-semibold">{post.metrics.impressions.toLocaleString()}</span>
              </div>
              <div className="text-xs text-muted-foreground">Impressions</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

interface OrganizationPostsProps {
  onRefresh?: boolean;
  onPostsFetched?: (posts: any[]) => void;
}

export const OrganizationPosts: React.FC<OrganizationPostsProps> = ({ onRefresh, onPostsFetched }) => {
  const { user } = useUser();
  const { selectedOrganization } = useOrganization();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [pagination, setPagination] = useState({
    start: 0,
    count: 10,
    total: 0,
    hasNext: false,
    hasPrev: false
  });

  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

  const fetchPosts = async (start = 0, forceRefresh = false) => {
    if (!user || !selectedOrganization) return;

    setLoading(true);
    setError(null);

    try {
      const orgUrn = `urn:li:organization:${selectedOrganization.id}`;
      const cacheKey = `posts_org_${selectedOrganization.id}`;
      const cacheTimestampKey = `${cacheKey}_timestamp`;
      
      // Check localStorage for cached data (only for first page)
      if (start === 0 && !forceRefresh) {
        const cachedData = localStorage.getItem(cacheKey);
        const cacheTimestamp = localStorage.getItem(cacheTimestampKey);
        
        // Check if cache is valid (less than 24 hours old)
        const twentyFourHours = 24 * 60 * 60 * 1000;
        const isCacheValid = cachedData && cacheTimestamp && 
          (Date.now() - parseInt(cacheTimestamp)) < twentyFourHours;
        
        if (isCacheValid) {
          console.log('Using cached posts data');
          const data = JSON.parse(cachedData);
          setPosts(data.posts || []);
          setPagination(prev => ({
            ...prev,
            start: data.paging.start || start,
            total: data.paging.total || 0,
            hasNext: data.paging.links?.some((link: any) => link.rel === 'next') || false,
            hasPrev: start > 0
          }));
          if (onPostsFetched) {
            onPostsFetched(data.posts || []);
          }
          setLoading(false);
          return;
        }
      }
      
      console.log(`Fetching fresh posts data${forceRefresh ? ' (forced refresh)' : ''}`);
      const response = await fetch(
        `${API_BASE_URL}/api/analytics/organization/posts/${user.id}/${encodeURIComponent(orgUrn)}?start=${start}&count=${pagination.count}`,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch posts');
      }

      const data = await response.json();
      
      // Cache the data (only for first page)
      if (start === 0) {
        const timestamp = Date.now();
        localStorage.setItem(cacheKey, JSON.stringify(data));
        localStorage.setItem(cacheTimestampKey, timestamp.toString());
      }
      
      setPosts(data.posts || []);
      setPagination(prev => ({
        ...prev,
        start: data.paging.start || start,
        total: data.paging.total || 0,
        hasNext: data.paging.links?.some((link: any) => link.rel === 'next') || false,
        hasPrev: start > 0
      }));
      
      // Notify parent component of fetched posts
      if (onPostsFetched && start === 0) {
        onPostsFetched(data.posts || []);
      }
    } catch (err) {
      console.error('Error fetching posts:', err);
      setError(err instanceof Error ? err.message : 'Failed to load posts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedOrganization) {
      fetchPosts(0);
    }
  }, [selectedOrganization]);
  
  // Handle refresh trigger from parent
  useEffect(() => {
    if (onRefresh && selectedOrganization) {
      fetchPosts(0, true); // Force refresh
    }
  }, [onRefresh]);

  const handlePageChange = (direction: 'next' | 'prev') => {
    const newStart = direction === 'next' 
      ? pagination.start + pagination.count
      : Math.max(0, pagination.start - pagination.count);
    fetchPosts(newStart);
  };

  if (!selectedOrganization || !user) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Organization Posts</CardTitle>
          <CardDescription>Select an organization to view posts</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Organization Posts</CardTitle>
          <CardDescription>Loading posts...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Organization Posts</CardTitle>
          <CardDescription>
            {error.includes('permission') ? (
              <div className="text-amber-600">
                <p className="font-medium">Limited Access</p>
                <p className="text-sm mt-1">You need administrator or content admin access to view posts for this organization.</p>
              </div>
            ) : error.includes('not available') ? (
              <div className="text-gray-600">
                <p className="font-medium">Posts Not Available</p>
                <p className="text-sm mt-1">This organization hasn't published any posts yet or they're not accessible.</p>
              </div>
            ) : (
              <div className="text-red-500">
                <p className="font-medium">Error Loading Posts</p>
                <p className="text-sm mt-1">{error}</p>
              </div>
            )}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // Separate posts by state
  const now = Date.now();
  const scheduledPosts = posts.filter(post => {
    const state = post.lifecycleState?.toUpperCase?.() || '';
    return state === 'SCHEDULED' || (!!post.scheduledAt && post.scheduledAt > now);
  });
  const draftPosts = posts.filter(post => (post.lifecycleState?.toUpperCase?.() || '') === 'DRAFT');
  const publishedPosts = posts.filter(post => {
    const state = post.lifecycleState?.toUpperCase?.() || '';
    const isScheduled = state === 'SCHEDULED' || (!!post.scheduledAt && post.scheduledAt > now);
    const isDraft = state === 'DRAFT';
    return !isScheduled && !isDraft;
  });

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Organization Posts</CardTitle>
          <CardDescription>
            Recent posts from {selectedOrganization.name}
            {pagination.total > 0 && ` (${pagination.total} total)`}
            {posts.length === 0 && !loading && !error && (
              <p className="text-xs text-gray-500 mt-2">
                Note: Post viewing requires admin or content management access to the organization.
              </p>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {posts.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No posts found for this organization</p>
          ) : (
            <div className="space-y-6">
              {scheduledPosts.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Calendar className="w-4 h-4" /> Scheduled posts ({scheduledPosts.length})
                  </div>
                  <div className="space-y-3">
                    {scheduledPosts.map(post => (
                      <Card
                        key={post.id}
                        className="cursor-pointer hover:shadow-md dark:hover:shadow-primary/20 transition-all border-amber-200 dark:border-amber-800/60"
                        onClick={() => setSelectedPost(post)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-2">
                            <div className="text-sm text-muted-foreground">
                              <Calendar className="w-4 h-4 inline mr-1" />
                              {post.scheduledAt ? `Scheduled for ${new Date(post.scheduledAt).toLocaleString()}` : 'Scheduled'}
                            </div>
                            <div className="text-xs text-amber-700 bg-amber-100 px-2 py-1 rounded dark:text-amber-200 dark:bg-amber-900/40">
                              Scheduled
                            </div>
                          </div>
                          <p className="text-sm mb-3 line-clamp-3 text-foreground">{post.textContent}</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {draftPosts.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <FileText className="w-4 h-4" /> Draft posts ({draftPosts.length})
                  </div>
                  <div className="space-y-3">
                    {draftPosts.map(post => (
                      <Card
                        key={post.id}
                        className="cursor-pointer hover:shadow-md dark:hover:shadow-primary/20 transition-all border-slate-200 dark:border-slate-800/60"
                        onClick={() => setSelectedPost(post)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-2">
                            <div className="text-sm text-muted-foreground">
                              <Calendar className="w-4 h-4 inline mr-1" />
                              {formatDistanceToNow(new Date(post.lastModifiedAt || post.createdAt), { addSuffix: true })}
                            </div>
                            <div className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                              Draft
                            </div>
                          </div>
                          <p className="text-sm mb-3 line-clamp-3 text-foreground">{post.textContent}</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {publishedPosts.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Calendar className="w-4 h-4" /> Published posts ({publishedPosts.length})
                  </div>
                  <div className="space-y-4">
                    {publishedPosts.map(post => (
                      <Card 
                        key={post.id} 
                        className="cursor-pointer hover:shadow-md dark:hover:shadow-primary/20 transition-all"
                        onClick={() => setSelectedPost(post)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-2">
                            <div className="text-sm text-muted-foreground">
                              <Calendar className="w-4 h-4 inline mr-1" />
                              {formatDistanceToNow(new Date(post.publishedAt || post.createdAt), { addSuffix: true })}
                            </div>
                            <div className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                              {post.visibility}
                            </div>
                          </div>

                          <p className="text-sm mb-3 line-clamp-3 text-foreground">{post.textContent}</p>

                          {post.media.length > 0 && (
                            <div className="flex gap-2 mb-3">
                              {post.media.map((item, index) => (
                                <div key={index} className="text-xs bg-muted px-2 py-1 rounded flex items-center gap-1">
                                  {item.type === 'image' && <Image className="w-3 h-3" />}
                                  {item.type === 'video' && <Video className="w-3 h-3" />}
                                  {item.type === 'article' && <FileText className="w-3 h-3" />}
                                  {item.type}
                                </div>
                              ))}
                            </div>
                          )}

                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1 hover:text-foreground transition-colors">
                              <Heart className="w-4 h-4" />
                              {post.metrics.likes.toLocaleString()}
                            </span>
                            <span className="flex items-center gap-1 hover:text-foreground transition-colors">
                              <MessageCircle className="w-4 h-4" />
                              {post.metrics.comments.toLocaleString()}
                            </span>
                            <span className="flex items-center gap-1 hover:text-foreground transition-colors">
                              <Repeat className="w-4 h-4" />
                              {post.metrics.reposts.toLocaleString()}
                            </span>
                            <span className="flex items-center gap-1 hover:text-foreground transition-colors">
                              <Eye className="w-4 h-4" />
                              {post.metrics.impressions.toLocaleString()}
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {(pagination.hasNext || pagination.hasPrev) && (
                <div className="flex justify-between items-center pt-4">
                  <Button
                    variant="outline"
                    onClick={() => handlePageChange('prev')}
                    disabled={!pagination.hasPrev}
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Previous
                  </Button>
                  
                  <span className="text-sm text-gray-600">
                    Showing {pagination.start + 1} - {Math.min(pagination.start + pagination.count, pagination.total)} of {pagination.total}
                  </span>

                  <Button
                    variant="outline"
                    onClick={() => handlePageChange('next')}
                    disabled={!pagination.hasNext}
                  >
                    Next
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedPost && (
        <PostModal 
          post={selectedPost} 
          isOpen={!!selectedPost} 
          onClose={() => setSelectedPost(null)} 
        />
      )}
    </>
  );
};